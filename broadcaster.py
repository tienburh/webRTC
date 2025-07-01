# broadcaster.py
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
    help="URL của signaling server (ví dụ: http://127.0.0.1:3000 hoặc https://example.com)",
)
args = parser.parse_args()
SIGNALING_SERVER = args.signaling

# ICE servers configuration
ICE_SERVERS = [RTCIceServer(urls="stun:stun.l.google.com:19302")]

# Initialize Socket.IO client
sio = socketio.AsyncClient()
relay = MediaRelay()
pcs = {}  # store peer connections by watcher ID

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
            raise RuntimeError("Không đọc được frame!")
        # Convert BGR to RGB
        frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        video_frame = VideoFrame.from_ndarray(frame, format='rgb24')
        video_frame.pts = pts
        video_frame.time_base = time_base
        return video_frame

@sio.event
async def connect():
    print(f"🔗 Đã kết nối signaling server tại {SIGNALING_SERVER}")
    await sio.emit('broadcaster')

@sio.event
async def watcher(watcher_id):
    print("👀 Watcher connected:", watcher_id)
    # Create peer connection with correct ICE configuration
    config = RTCConfiguration(iceServers=ICE_SERVERS)
    pc = RTCPeerConnection(configuration=config)
    pcs[watcher_id] = pc

    # Add camera track to peer connection
    cam_track = CameraTrack()
    pc.addTrack(relay.subscribe(cam_track))

    @pc.on('icecandidate')
    async def on_ice(event):
        if event.candidate:
            await sio.emit('candidate', watcher_id, event.candidate)

    # Create and send offer to watcher
    offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    await sio.emit('offer', watcher_id, pc.localDescription)

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

if __name__ == '__main__':
    asyncio.run(main())
