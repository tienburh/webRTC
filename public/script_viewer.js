const socket = io();
const peerConnections = {};
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const remoteVideo = document.getElementById('remoteVideo');

console.log('📡 Connecting as viewer...');
socket.emit('watcher');

socket.on('offer', async (id, description) => {
  console.log('📨 Received offer from broadcaster:', id);

  const pc = new RTCPeerConnection(config);
  peerConnections[id] = pc;

  pc.ontrack = event => {
    console.log('📺 Received remote track:', event.streams[0]);
    remoteVideo.srcObject = event.streams[0];
    remoteVideo.play().catch(err => {
    console.warn('⚠️ Không thể tự động phát video:', err);
    });
    // Kiểm tra lại sau 3 giây xem video đã được gán chưa
    setTimeout(() => {
      if (!remoteVideo.srcObject) {
        console.warn('⚠️ Chưa có video stream sau 3s!');
        alert('Không nhận được video từ broadcaster. Kiểm tra lại kế  t nối hoặc thử reload!');
      }
    }, 3000);
  };

  pc.onicecandidate = event => {
    if (event.candidate) {
      console.log('📤 Sending ICE candidate to broadcaster');
      socket.emit('candidate', id, event.candidate);
    }
  };

  console.log('🧾 Setting remote description...');
  await pc.setRemoteDescription(description);

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  console.log('📤 Sending answer to broadcaster');
  socket.emit('answer', id, pc.localDescription);
});

socket.on('candidate', (id, candidate) => {
  console.log('📥 Received ICE candidate from broadcaster');
  peerConnections[id]?.addIceCandidate(new RTCIceCandidate(candidate));
});
