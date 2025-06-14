const socket = io();
const peerConnections = {};
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const remoteVideo = document.getElementById('remoteVideo');
const startBtn = document.getElementById('startBtn');

startBtn.addEventListener('click', () => {
  console.log('📡 Connecting as viewer...');
  socket.emit('watcher');
});

// Nhận offer từ broadcaster
socket.on('offer', async (id, description) => {
  console.log('📨 Received offer from broadcaster:', id);

  const pc = new RTCPeerConnection(config);
  peerConnections[id] = pc;

  pc.ontrack = event => {
    console.log('📺 Received remote track:', event.streams[0]);
    remoteVideo.srcObject = event.streams[0];
    remoteVideo.play().then(() => {
      console.log('▶️ Video started successfully');
    }).catch(err => {
      console.warn('⚠️ play() failed again:', err);
    });
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

// Nhận ICE candidate từ broadcaster
socket.on('candidate', (id, candidate) => {
  console.log('📥 Received ICE candidate from broadcaster');
  peerConnections[id]?.addIceCandidate(new RTCIceCandidate(candidate));
});
