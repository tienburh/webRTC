import asyncio
import cv2
import socketio
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, VideoStreamTrack
from aiortc.contrib.media import MediaRelay
from av import VideoFrame

# Địa chỉ signaling server (để trống = localhost:3000)
SIGNALING_SERVER = 'http://localhost:3000'

# cấu hình STUN
ICE_CONFIG = {'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]}

sio = socketio.AsyncClient()
relay = MediaRelay()
pcs = {}  # lưu RTCPeerConnection theo watcher_id

class CameraTrack(VideoStreamTrack):
    def __init__(self):
        super().__init__()
        self.cap = cv2.VideoCapture(0)
        if not self.cap.isOpened():
            raise RuntimeError("Không mở được camera")

    async def recv(self):
        pts, time_base = await self.next_timestamp()
        ret, frame = self.cap.read()
        if not ret:
            raise RuntimeError("Không lấy được frame")
        # BGR -> RGB
        frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        video_frame = VideoFrame.from_ndarray(frame, format='rgb24')
        video_frame.pts = pts
        video_frame.time_base = time_base
        return video_frame

@sio.event
async def connect():
    print("🔗 Đã kết nối signaling server")
    # đăng ký là broadcaster
    await sio.emit('broadcaster')

@sio.event
async def watcher(watcher_id):
    """
    Khi có viewer (watcher) mới, tạo PeerConnection, add camera,
    tạo offer và gửi xuống watcher.
    """
    print("👀 Watcher connected:", watcher_id)
    pc = RTCPeerConnection(configuration=ICE_CONFIG)
    pcs[watcher_id] = pc

    # add camera vào peer connection
    cam = CameraTrack()
    pc.addTrack(relay.subscribe(cam))

    @pc.on('icecandidate')
    async def on_ice(event):
        if event.candidate:
            await sio.emit('candidate', watcher_id, event.candidate)

    # tạo offer
    offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    # gửi offer xuống watcher
    await sio.emit('offer', watcher_id, pc.localDescription)

@sio.event
async def answer(watcher_id, description):
    """
    Khi watcher trả về answer, gán vào peer connection.
    """
    print("📨 Received answer from", watcher_id)
    pc = pcs.get(watcher_id)
    if pc:
        await pc.setRemoteDescription(RTCSessionDescription(**description))

@sio.event
async def candidate(peer_id, candidate):
    """
    Khi watcher gửi ICE candidate, thêm vào PC.
    """
    pc = pcs.get(peer_id)
    if pc:
        await pc.addIceCandidate(RTCIceCandidate(**candidate))

@sio.event
async def disconnectPeer(peer_id):
    """
    Khi watcher/ngắt kết nối.
    """
    print("❌ Viewer disconnected:", peer_id)
    pc = pcs.pop(peer_id, None)
    if pc:
        await pc.close()

async def main():
    await sio.connect(SIGNALING_SERVER)
    print("🚀 Broadcaster ready, streaming camera …")
    await sio.wait()

if __name__ == '__main__':
    asyncio.run(main())