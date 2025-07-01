import argparse
import asyncio
import cv2
import socketio
from aiortc import (
    RTCPeerConnection,
    RTCSessionDescription,
    RTCIceCandidate,
    VideoStreamTrack,
    RTCConfiguration,
    RTCIceServer
)
from aiortc.contrib.media import MediaRelay
from av import VideoFrame

# Parse command-line arguments
parser = argparse.ArgumentParser(description="Python WebRTC Broadcaster")
parser.add_argument(
    "--signaling",
    default="http://localhost:3000",
    help="URL của signaling server (ví dụ: http://127.0.0.1:3000 hoặc https://example.com)"
)
args = parser.parse_args()
SIGNALING_SERVER = args.signaling

# ICE server config
ICE_SERVERS = [RTCIceServer(urls="stun:stun.l.google.com:19302")]
relay = MediaRelay()
pcs = {}

# Socket.IO client
sio = socketio.AsyncClient()


class CameraTrack(VideoStreamTrack):
    def __init__(self):
        super().__init__()
        self.cap = cv2.VideoCapture(0)
        if not self.cap.isOpened():
            raise RuntimeError("Không mở được camera!")

    async def recv(self):
        pts, time_base = await self.next_timestamp()
        ret, frame = self.cap.read()
        if not ret:
            raise RuntimeError("Không đọc được frame từ camera!")
        frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        video_frame = VideoFrame.from_ndarray(frame, format='rgb24')
        video_frame.pts = pts
        video_frame.time_base = time_base
        return video_frame


# Utility: convert RTCSessionDescription to dict
def sdp_to_dict(desc):
    return {
        "sdp": desc.sdp,
        "type": desc.type
    }


# Utility: convert ICECandidate to dict
def candidate_to_dict(candidate):
    return {
        "candidate": candidate.candidate,
        "sdpMid": candidate.sdpMid,
        "sdpMLineIndex": candidate.sdpMLineIndex
    }


@sio.event
async def connect():
    print(f"🔗 Đã kết nối đến signaling server tại {SIGNALING_SERVER}")
    await sio.emit("broadcaster")


@sio.event
async def watcher(watcher_id):
    print("👀 Watcher connected:", watcher_id)
    config = RTCConfiguration(iceServers=ICE_SERVERS)
    pc = RTCPeerConnection(configuration=config)
    pcs[watcher_id] = pc

    cam_track = CameraTrack()
    pc.addTrack(relay.subscribe(cam_track))

    @pc.on("icecandidate")
    async def on_ice(event):
        if event.candidate:
            await sio.emit("candidate", watcher_id, candidate_to_dict(event.candidate))

    # Create and send offer
    offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    await sio.emit("offer", {
    "id": watcher_id,
    "description": sdp_to_dict(pc.localDescription)
})

@sio.event
async def answer(watcher_id, description):
    print("📨 Received answer from", watcher_id)
    pc = pcs.get(watcher_id)
    if pc:
        await pc.setRemoteDescription(RTCSessionDescription(**description))


@sio.event
async def candidate(peer_id, candidate):
    pc = pcs.get(peer_id)
    if pc:
        await pc.addIceCandidate(RTCIceCandidate(**candidate))


@sio.event
async def disconnectPeer(peer_id):
    print("❌ Viewer disconnected:", peer_id)
    pc = pcs.pop(peer_id, None)
    if pc:
        await pc.close()


async def main():
    try:
        await sio.connect(SIGNALING_SERVER)
    except Exception as e:
        print(f"⚠️ Không thể kết nối đến signaling server: {e}")
        return
    print("🚀 Broadcaster is streaming …")
    await sio.wait()


if __name__ == "__main__":
    asyncio.run(main())
