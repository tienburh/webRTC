const socket = io();
const peerConnections = {};
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const remoteVideo = document.getElementById('remoteVideo');

socket.emit('watcher');

socket.on('offer', async (id, description) => {
  const pc = new RTCPeerConnection(config);
  peerConnections[id] = pc;

  await pc.setRemoteDescription(description);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('answer', id, pc.localDescription);

  pc.ontrack = event => {
    remoteVideo.srcObject = event.streams[0];
  };

  pc.onicecandidate = event => {
    if (event.candidate) {
      socket.emit('candidate', id, event.candidate);
    }
  };
});

socket.on('candidate', (id, candidate) => {
  peerConnections[id]?.addIceCandidate(new RTCIceCandidate(candidate));
});