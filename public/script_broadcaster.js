// Kết nối socket.io client với signaling server
const socket = io();

// Lưu peer connections với từng viewer
const peerConnections = {};

// Cấu hình STUN server
const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// Tham chiếu phần tử video hiển thị camera local
const localVideo = document.getElementById('localVideo');

// Khi trang được tải xong, tự động bắt đầu stream
window.onload = async () => {
  console.log('📷 Auto-start streaming on page load');

  try {
    // Yêu cầu quyền truy cập camera + micro
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    console.log('✅ Camera stream acquired');
    localVideo.srcObject = stream;

    // Đăng ký là broadcaster với signaling server
    socket.emit('broadcaster');

    // Khi có viewer mới kết nối
    socket.on('watcher', async id => {
      console.log('📡 Watcher connected:', id);

      const pc = new RTCPeerConnection(config);
      peerConnections[id] = pc;

      // Thêm track từ stream local vào peer connection
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // Gửi ICE candidate đến viewer
      pc.onicecandidate = event => {
        if (event.candidate) {
          socket.emit('candidate', id, event.candidate);
        }
      };

      // Tạo offer và gửi cho viewer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('offer', id, pc.localDescription);
    });

    // Nhận answer từ viewer
    socket.on('answer', (id, description) => {
      console.log('📨 Received answer from', id);
      peerConnections[id]?.setRemoteDescription(description);
    });

    // Nhận ICE candidate từ viewer
    socket.on('candidate', (id, candidate) => {
      console.log('📨 Received ICE candidate from', id);
      peerConnections[id]?.addIceCandidate(new RTCIceCandidate(candidate));
    });

    // Khi viewer ngắt kết nối
    socket.on('disconnectPeer', id => {
      console.log('❌ Viewer disconnected:', id);
      peerConnections[id]?.close();
      delete peerConnections[id];
    });

  } catch (err) {
    console.error('❌ getUserMedia error:', err);
    alert('Lỗi khi truy cập camera: ' + err.name + ' – ' + err.message);
  }
};