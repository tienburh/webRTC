const socket = io();
const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};
const peerConnections = {};
const remoteVideo = document.getElementById('remoteVideo');

console.log("✅ script_viewer.js loaded");

// Chờ broadcaster xuất hiện mới gửi watcher
socket.on('broadcaster', () => {
  console.log('📡 Broadcaster available -> gửi watcher');
  socket.emit('watcher');
});

socket.on('offer', async (id, description) => {
  console.log('📨 Received offer from broadcaster:', id);

  const pc = new RTCPeerConnection(config);
  peerConnections[id] = pc;

  pc.ontrack = (event) => {
    const stream = event.streams[0];
    if (remoteVideo.srcObject !== stream) {
      remoteVideo.srcObject = stream;
      remoteVideo.onloadedmetadata = () => {
        remoteVideo.play().catch(err => {
          console.warn('⚠️ Cannot autoplay video:', err);
          alert('⚠️ Trình duyệt không cho phép tự động phát video. Hãy nhấn "Start Video".');
        });
      };
    }
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('candidate', id, event.candidate);
    }
  };

  await pc.setRemoteDescription(description);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('answer', id, pc.localDescription);
  console.log('📤 Sent answer back to broadcaster');
});

socket.on('candidate', (id, candidate) => {
  const pc = peerConnections[id];
  if (pc) {
    pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => {
      console.error('❌ Lỗi khi thêm ICE Candidate:', e);
    });
  }
});

socket.on('disconnectPeer', id => {
  console.log(`❌ Broadcaster disconnected: ${id}`);
  if (peerConnections[id]) {
    peerConnections[id].close();
    delete peerConnections[id];
  }
});

document.getElementById('playButton').addEventListener('click', () => {
  if (remoteVideo.srcObject) {
    remoteVideo.play().catch(err => {
      console.error('❌ Error playing video:', err);
      alert('Không thể phát video: ' + err.message);
    });
  } else {
    alert('⚠️ Chưa nhận được stream từ Drone!');
  }
});
