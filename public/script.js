// Khởi tạo socket.io client để kết nối với signaling server
const socket = io();

// Lưu các peer connections với các viewer, key là socket ID
const peerConnections = {};

// Cấu hình ICE Server, ở đây sử dụng STUN server của Google
const config = { 
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// === Tham chiếu đến các phần tử HTML ===
const localVideo  = document.getElementById('localVideo');   // video hiển thị camera local
const remoteVideo = document.getElementById('remoteVideo');  // video hiển thị luồng nhận từ người khác
const startBtn    = document.getElementById('startBtn');     // nút bắt đầu truyền (broadcaster)
const stopBtn     = document.getElementById('stopBtn');      // nút dừng truyền
const joinBtn     = document.getElementById('joinBtn');      // nút tham gia xem (viewer)

//broadcast
if (startBtn) {
  console.log('▶ Found startBtn, attaching handler');

  // Khi nhấn Start
  startBtn.addEventListener('click', async () => {
    console.log('>> Start clicked');
    try {
      // Yêu cầu quyền truy cập camera và micro
      console.log('>> Requesting camera...');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      console.log('<< Camera OK:', stream);

      // Hiển thị luồng video local
      localVideo.srcObject = stream;

      // Gửi thông báo lên server là người dùng này là broadcaster
      socket.emit('broadcaster');

      // Vô hiệu hóa nút Start, bật nút Stop
      startBtn.disabled = true;
      stopBtn.disabled = false;
    } catch (err) {
      console.error('❌ getUserMedia error:', err);
      alert('Lỗi khi truy cập camera: ' + err.name + ' – ' + err.message);
    }
  });

  // Khi nhấn Stop thì reload lại trang
  stopBtn?.addEventListener('click', () => window.location.reload());

  // Khi có viewer kết nối (server gửi về socket ID của viewer)
  socket.on('watcher', async id => {
    console.log('📡 Watcher connected:', id);

    // Tạo peer connection mới cho viewer
    const pc = new RTCPeerConnection(config);
    peerConnections[id] = pc;

    // Thêm track từ stream local vào peer connection
    const stream = localVideo.srcObject;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    // Gửi ICE candidate cho viewer
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

  // Khi nhận answer từ viewer
  socket.on('answer', (id, description) => {
    console.log('📨 Received answer from', id);
    peerConnections[id]?.setRemoteDescription(description);
  });

  // Khi nhận ICE candidate từ viewer
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
}


//viewer
if (joinBtn) {
  // Khi nhấn Join thì gửi tín hiệu lên server là muốn xem
  joinBtn.addEventListener('click', () => socket.emit('watcher'));

  // Khi nhận được offer từ broadcaster
  socket.on('offer', async (id, desc) => {
    // Tạo peer connection mới và lưu lại
    const pc = new RTCPeerConnection(config);
    peerConnections[id] = pc;

    // Thiết lập mô tả từ xa (offer)
    await pc.setRemoteDescription(desc);

    // Tạo answer và gửi lại cho broadcaster
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('answer', id, answer);

    // Khi nhận được stream từ broadcaster
    pc.ontrack = e => {
      remoteVideo.srcObject = e.streams[0];
    };

    // Gửi ICE candidate cho broadcaster
    pc.onicecandidate = e => {
      if (e.candidate) socket.emit('candidate', id, e.candidate);
    };
  });

  // Khi nhận ICE candidate từ broadcaster
  socket.on('candidate', (id, candidate) => {
    peerConnections[id]?.addIceCandidate(new RTCIceCandidate(candidate));
  });
}
