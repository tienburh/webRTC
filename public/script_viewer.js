const socket = io();
const peerConnections = {};
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

const remoteVideo = document.getElementById('remoteVideo');
const playButton = document.getElementById('playButton');

let receivedStream = null;
let streamReady = false;

// ✅ Chờ khi broadcaster sẵn sàng thì mới gửi 'watcher'
socket.on('broadcaster', () => {
  console.log('📡 Broadcaster is available. Registering as watcher...');
  socket.emit('watcher');
});

// 🔄 Fallback: nếu viewer vào trước broadcaster, tự động thử gửi watcher sau 3 giây
setTimeout(() => {
  socket.emit('watcher');
  console.log('⏳ Retry sending watcher after timeout.');
}, 3000);

// 📨 Khi nhận được offer từ broadcaster
socket.on('offer', async (id, description) => {
  console.log('📨 Received offer from broadcaster:', id);

  const pc = new RTCPeerConnection(config);
  peerConnections[id] = pc;

  await pc.setRemoteDescription(description);
  console.log('🧾 Remote description set.');

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  console.log('📤 Sending answer to broadcaster');
  socket.emit('answer', id, pc.localDescription);

  pc.ontrack = event => {
    console.log('📺 Received remote track event.');
    const stream = event.streams[0];
    if (stream) {
      receivedStream = stream;
      remoteVideo.srcObject = receivedStream;
      streamReady = true;

      remoteVideo.play().then(() => {
        console.log('▶️ Video is playing automatically.');
      }).catch(err => {
        console.warn('⚠️ Autoplay failed. User interaction may be required.', err);
      });
    } else {
      console.warn('⚠️ No stream received!');
    }
  };

  pc.onicecandidate = event => {
    if (event.candidate) {
      console.log('📤 Sending ICE candidate to broadcaster');
      socket.emit('candidate', id, event.candidate);
    }
  };
});

// 📨 Nhận ICE candidate
socket.on('candidate', (id, candidate) => {
  console.log('📥 Received ICE candidate from broadcaster');
  const pc = peerConnections[id];
  if (pc) {
    pc.addIceCandidate(new RTCIceCandidate(candidate));
  }
});

// 🧹 Khi peer rớt
socket.on('disconnectPeer', id => {
  console.log(`❌ Peer disconnected: ${id}`);
  const pc = peerConnections[id];
  if (pc) {
    pc.close();
    delete peerConnections[id];
  }
});

// ▶️ Nút start video
window.addEventListener('DOMContentLoaded', () => {
  if (playButton) {
    playButton.addEventListener('click', () => {
      if (streamReady && receivedStream) {
        remoteVideo.play().then(() => {
          console.log('▶️ Video manually started by user.');
        }).catch(err => {
          console.error('❌ Error playing video:', err);
          alert('Không thể phát video: ' + err.message);
        });
      } else {
        alert('⚠️ Video chưa sẵn sàng! Vui lòng chờ kết nối với Drone.');
      }
    });
  }
});
