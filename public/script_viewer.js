const socket = io();
const peerConnections = {};
const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const remoteVideo = document.getElementById('remoteVideo');

let receivedStream = null;

// Gửi sự kiện "watcher" ngay khi kết nối
socket.emit('watcher');
console.log('📡 Sent watcher signal');

socket.on('offer', async (id, description) => {
  console.log('📨 Received offer from broadcaster:', id);

  const pc = new RTCPeerConnection(config);
  peerConnections[id] = pc;

  pc.ontrack = (event) => {
    console.log('📺 Received remote track event');
    receivedStream = event.streams[0];

    if (receivedStream) {
      remoteVideo.srcObject = receivedStream;

      remoteVideo.play().then(() => {
        console.log('▶️ Video is playing');
      }).catch(err => {
        console.warn('⚠️ Cannot autoplay video:', err);
        alert('⚠️ Trình duyệt không cho phép tự động phát video. Vui lòng nhấn nút "Start Video" nếu có.');
      });
    } else {
      console.warn('⚠️ Không có stream nhận được!');
    }
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('candidate', id, event.candidate);
    }
  };

  try {
    await pc.setRemoteDescription(description);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('answer', id, pc.localDescription);
    console.log('📤 Sent answer back to broadcaster');
  } catch (err) {
    console.error('❌ Lỗi khi thiết lập PeerConnection:', err);
  }
});

socket.on('candidate', (id, candidate) => {
  const pc = peerConnections[id];
  if (pc) {
    pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => {
      console.error('❌ Lỗi khi thêm ICE Candidate:', e);
    });
  }
});

// Optional: khi broadcaster mất kết nối
socket.on('disconnectPeer', id => {
  console.log(`❌ Broadcaster disconnected: ${id}`);
  if (peerConnections[id]) {
    peerConnections[id].close();
    delete peerConnections[id];
  }
});
