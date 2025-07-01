import asyncio
import cv2
from aiortc import RTCPeerConnection, RTCSessionDescription, VideoStreamTrack, RTCIceCandidate
from av import VideoFrame
import socketio

sio = socketio.AsyncClient()
pcs = {}

class CameraVideoTrack(VideoStreamTrack):
    def __init__(self):
        super().__init__()
        self.cap = cv2.VideoCapture(0)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 360)

    async def recv(self):
        pts, time_base = await self.next_timestamp()
        ret, frame = self.cap.read()
        if not ret:
            return None
        frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        video_frame = VideoFrame.from_ndarray(frame, format="rgb24")
        video_frame.pts = pts
        video_frame.time_base = time_base
        return video_frame

video_track = CameraVideoTrack()

def sdp_to_dict(sdp):
    return {"sdp": sdp.sdp, "type": sdp.type}

@sio.event
async def connect():
    print("🔗 Đã kết nối đến signaling server tại http://localhost:3000")
    await sio.emit("broadcaster")

@sio.on("watcher")
async def on_watcher(watcher_id):
    print(f"👀 Watcher connected: {watcher_id}")
    pc = RTCPeerConnection()
    pcs[watcher_id] = pc

    @pc.on("icecandidate")
    async def on_icecandidate(event):
        if event.candidate:
            await sio.emit("candidate", {
                "id": watcher_id,
                "candidate": {
                    "sdpMid": event.candidate.sdpMid,
                    "sdpMLineIndex": event.candidate.sdpMLineIndex,
                    "candidate": event.candidate.candidate
                }
            })

    pc.addTrack(video_track)
    await pc.setLocalDescription(await pc.createOffer())
    await sio.emit("offer", {
        "id": watcher_id,
        "description": sdp_to_dict(pc.localDescription)
    })

@sio.on("answer")
async def on_answer(data):
    pc = pcs.get(data["id"])
    if pc:
        desc = RTCSessionDescription(**data["description"])
        await pc.setRemoteDescription(desc)
        print(f"📨 Received answer from {data['id']}")

@sio.on("candidate")
async def on_candidate(data):
    pc = pcs.get(data["id"])
    if pc:
        c = data["candidate"]
        candidate = RTCIceCandidate(
            sdpMid=c["sdpMid"],
            sdpMLineIndex=c["sdpMLineIndex"],
            candidate=c["candidate"]
        )
        await pc.addIceCandidate(candidate)

@sio.event
async def disconnect():
    print("❌ Disconnected from signaling server")

async def main():
    await sio.connect("http://localhost:3000")
    await sio.wait()

if __name__ == "__main__":
    asyncio.run(main())
