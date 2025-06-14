const socket = io();
const peerConnections = {};
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

const remoteVideo = document.getElementById('remoteVideo');
const playButton = document.getElementById('playButton');

let receivedStream = null;

console.log('📡 Connecting as viewer...');
socket.emit('watcher');

socket.on('offer', async (id, description) => {
  console.log('📨 Received offer from broadcaster:', id);

  const pc = new RTCPeerConnection(config);
  peerConnections[id] = pc;

  await pc.setRemoteDescription(description);
  console.log('🧾 Setting remote description...');

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  console.log('📤 Sending answer to broadcaster');
  socket.emit('answer', id, pc.localDescription);

  pc.ontrack = event => {
    console.log('📺 Received remote track event.');
    const stream = event.streams[0];
    if (stream) {
      console.log('✅ Remote stream received:', stream);
      console.log('🎥 Remote stream tracks:', stream.getTracks());
      console.log('🎥 Remote video tracks:', stream.getVideoTracks());

      receivedStream = stream;
      remoteVideo.srcObject = receivedStream;

      remoteVideo.play().then(() => {
        console.log('▶️ Video is playing automatically.');
      }).catch(err => {
        console.warn('⚠️ Không thể tự động phát video:', err);
      });
    } else {
      console.warn('⚠️ Không nhận được stream từ broadcaster!');
    }
  };

  pc.onicecandidate = event => {
    if (event.candidate) {
      console.log('📤 Sending ICE candidate to broadcaster');
      socket.emit('candidate', id, event.candidate);
    }
  };
});

socket.on('candidate', (id, candidate) => {
  console.log('📥 Received ICE candidate from broadcaster');
  peerConnections[id]?.addIceCandidate(new RTCIceCandidate(candidate));
});

window.addEventListener('DOMContentLoaded', () => {
  if (playButton) {
    playButton.addEventListener('click', () => {
      if (receivedStream) {
        remoteVideo.play().then(() => {
          console.log('▶️ Video started manually.');
        }).catch(err => {
          console.error('🎬 Error playing video:', err);
        });
      } else {
        alert('⚠️ Video stream chưa sẵn sàng!');
      }
    });
  }
});
