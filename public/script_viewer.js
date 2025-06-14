const socket = io();
const peerConnections = {};
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

const remoteVideo = document.getElementById('remoteVideo');
const playButton = document.getElementById('playButton');
const statusText = document.getElementById('statusText');

let receivedStream = null;

console.log('📡 Connecting as viewer...');
socket.emit('watcher');

socket.on('offer', async (id, description) => {
  console.log('📨 Received offer from broadcaster:', id);

  const pc = new RTCPeerConnection(config);
  peerConnections[id] = pc;

  await pc.setRemoteDescription(description);
  console.log('🧾 Remote description set');

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  console.log('📤 Sending answer');
  socket.emit('answer', id, pc.localDescription);

  pc.ontrack = event => {
    const stream = event.streams[0];
    if (stream) {
      console.log('✅ Stream received:', stream);
      receivedStream = stream;
      remoteVideo.srcObject = stream;

      remoteVideo.play().then(() => {
        console.log('▶️ Video is playing automatically.');
        statusText.textContent = "✅ Video đang phát!";
      }).catch(err => {
        console.warn('⚠️ Không thể tự động phát:', err);
        playButton.classList.remove('hidden');
        statusText.textContent = "🔈 Bấm Start để phát video";
      });
    } else {
      console.warn('⚠️ Không có stream từ broadcaster');
      statusText.textContent = "❌ Không có tín hiệu video!";
    }
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

playButton.addEventListener('click', () => {
  if (receivedStream) {
    remoteVideo.play().then(() => {
      console.log('▶️ Video started manually');
      playButton.classList.add('hidden');
      statusText.textContent = "✅ Video đang phát!";
    }).catch(err => {
      console.error('🎬 Error playing video:', err);
      statusText.textContent = "❌ Không thể phát video!";
    });
  } else {
    alert('⚠️ Video stream chưa sẵn sàng!');
  }
});
