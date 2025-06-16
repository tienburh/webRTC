// 👉 Kết nối đến signaling server
const socket = io();

// 👉 Cấu hình ICE server (giúp kết nối xuyên NAT, qua Internet)
const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// 👉 Lưu các PeerConnection với broadcaster
const peerConnections = {};

// 👉 Tham chiếu phần tử video
const remoteVideo = document.getElementById('remoteVideo');
let receivedStream = null;

// 📡 Gửi sự kiện 'watcher' ngay khi kết nối
socket.emit('watcher');
console.log('📡 Sent watcher signal');

// 📨 Khi nhận được 'offer' từ broadcaster
socket.on('offer', async (id, description) => {
  console.log('📨 Received offer from broadcaster:', id);

  const pc = new RTCPeerConnection(config);
  peerConnections[id] = pc;

  // 📺 Khi nhận được track video từ phía broadcaster
  pc.ontrack = (event) => {
    console.log('📺 Received remote track event');

    const stream = event.streams[0];

    if (remoteVideo.srcObject !== stream) {
      remoteVideo.srcObject = stream;

      // Khi metadata đã load thì gọi play
      remoteVideo.onloadedmetadata = () => {
        remoteVideo.play().then(() => {
          console.log('▶️ Video is playing');
        }).catch(err => {
          console.warn('⚠️ Cannot autoplay video:', err);
          alert('⚠️ Trình duyệt không cho phép tự động phát video. Hãy nhấn nút "Start Video" nếu có.');
        });
      };
    } else {
      console.log('⚠️ Stream đã được gán từ trước.');
    }
  };

  // ❄️ Gửi ICE candidate khi có
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('candidate', id, event.candidate);
    }
  };

  try {
    await pc.setRemoteDescription(description);       // Gán offer từ broadcaster
    const answer = await pc.createAnswer();           // Tạo answer
    await pc.setLocalDescription(answer);             // Gán local SDP
    socket.emit('answer', id, pc.localDescription);   // Gửi answer về broadcaster
    console.log('📤 Sent answer back to broadcaster');
  } catch (err) {
    console.error('❌ Lỗi khi thiết lập PeerConnection:', err);
  }
});

// 📥 Khi nhận ICE candidate từ broadcaster
socket.on('candidate', (id, candidate) => {
  const pc = peerConnections[id];
  if (pc) {
    pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => {
      console.error('❌ Lỗi khi thêm ICE Candidate:', e);
    });
  }
});

// ❌ Khi broadcaster ngắt kết nối
socket.on('disconnectPeer', id => {
  console.log(`❌ Broadcaster disconnected: ${id}`);
  if (peerConnections[id]) {
    peerConnections[id].close();
    delete peerConnections[id];
  }
});

// ▶️ Bắt sự kiện người dùng nhấn nút Play nếu autoplay bị chặn
const playButton = document.getElementById('playButton');
if (playButton) {
  playButton.addEventListener('click', () => {
    if (remoteVideo.srcObject) {
      remoteVideo.play().catch(err => {
        console.error('❌ Error playing video:', err);
        alert('Không thể phát video: ' + err.message);
      });
    } else {
      alert('⚠️ Chưa nhận được stream từ Drone!');
    }
  });
}
