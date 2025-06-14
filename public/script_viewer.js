const socket = io();
const peerConnections = {};
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

const remoteVideo = document.getElementById('remoteVideo');
const playButton = document.getElementById('playButton');
let receivedStream = null;

socket.emit('watcher');

socket.on('offer', async (id, desc) => {
  const pc = new RTCPeerConnection(config);
  peerConnections[id] = pc;
  await pc.setRemoteDescription(desc);

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('answer', id, pc.localDescription);

  pc.ontrack = event => {
    receivedStream = event.streams[0];
    remoteVideo.srcObject = receivedStream;
    remoteVideo.play().catch(console.warn);
  };

  pc.onicecandidate = e => {
    if (e.candidate) socket.emit('candidate', id, e.candidate);
  };
});

socket.on('candidate', (id, candidate) => {
  peerConnections[id]?.addIceCandidate(new RTCIceCandidate(candidate));
});

window.addEventListener('DOMContentLoaded', () => {
  playButton?.addEventListener('click', () => {
    if (receivedStream) {
      remoteVideo.play().catch(console.error);
    } else {
      alert('⚠️ Video chưa sẵn sàng!');
    }
  });
});
