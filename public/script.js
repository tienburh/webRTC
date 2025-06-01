// Khoi tao socket.io client de ket noi voi signaling server
const socket = io();

// Luu cac peer connections voi cac viewer, key la socket ID
const peerConnections = {};

// Cau hinh ICE Server, o day su dung STUN server cua Google
const config = { 
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// === Tham chieu den cac phan tu HTML ===
const localVideo  = document.getElementById('localVideo');   // video hien thi camera local
const remoteVideo = document.getElementById('remoteVideo');  // video hien thi luong nhan tu nguoi khac
const startBtn    = document.getElementById('startBtn');     // nut bat dau truyen (broadcaster)
const stopBtn     = document.getElementById('stopBtn');      // nut dung truyen
const joinBtn     = document.getElementById('joinBtn');      // nut tham gia xem (viewer)

// --- Broadcaster ---
if (startBtn) {
  console.log('▶ Found startBtn, attaching handler');

  let flippedStream = null; // lưu để dùng sau

  // Khi nhan Start
  startBtn.addEventListener('click', async () => {
    console.log('>> Start clicked');
    try {
      console.log('>> Requesting camera...');
      const originalStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      console.log('<< Camera OK:', originalStream);

      // Tạo video ẩn để vẽ lên canvas
      const hiddenVideo = document.createElement('video');
      hiddenVideo.srcObject = originalStream;
      hiddenVideo.muted = true;
      hiddenVideo.play();

      // Tạo canvas để flip ngang
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      await new Promise(resolve => {
        hiddenVideo.onloadedmetadata = () => {
          canvas.width = hiddenVideo.videoWidth;
          canvas.height = hiddenVideo.videoHeight;
          resolve();
        };
      });

      function draw() {
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(-1, 1); // flip ngang
        ctx.drawImage(hiddenVideo, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();
        requestAnimationFrame(draw);
      }
      draw();

      // Capture stream từ canvas
      flippedStream = canvas.captureStream(30); // 30fps
      // Gắn thêm track audio
      originalStream.getAudioTracks().forEach(track => {
        flippedStream.addTrack(track);
      });

      // Hiển thị video lên local preview
      localVideo.srcObject = flippedStream;

      // Gửi thông báo broadcaster
      socket.emit('broadcaster');

      startBtn.disabled = true;
      stopBtn.disabled = false;
    } catch (err) {
      console.error('❌ getUserMedia error:', err);
      alert('Lỗi khi truy cập camera: ' + err.name + ' – ' + err.message);
    }
  });

  // Khi nhấn Stop thì reload lại trang
  stopBtn?.addEventListener('click', () => window.location.reload());

  // Khi có viewer kết nối
  socket.on('watcher', async id => {
    console.log('📡 Watcher connected:', id);

    const pc = new RTCPeerConnection(config);
    peerConnections[id] = pc;

    // Sử dụng stream đã flip để gửi
    if (flippedStream) {
      flippedStream.getTracks().forEach(track => pc.addTrack(track, flippedStream));
    }

    pc.onicecandidate = event => {
      if (event.candidate) {
        socket.emit('candidate', id, event.candidate);
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('offer', id, pc.localDescription);
  });

  socket.on('answer', (id, description) => {
    console.log('📨 Received answer from', id);
    peerConnections[id]?.setRemoteDescription(description);
  });

  socket.on('candidate', (id, candidate) => {
    console.log('📨 Received ICE candidate from', id);
    peerConnections[id]?.addIceCandidate(new RTCIceCandidate(candidate));
  });

  socket.on('disconnectPeer', id => {
    console.log('❌ Viewer disconnected:', id);
    peerConnections[id]?.close();
    delete peerConnections[id];
  });
}

// --- Viewer ---
if (joinBtn) {
  // Khi nhan Join thi gui tin hieu len server la muon xem
  joinBtn.addEventListener('click', () => socket.emit('watcher'));

  // Khi nhan duoc offer tu broadcaster
  socket.on('offer', async (id, desc) => {
    // Tao peer connection moi va luu lai
    const pc = new RTCPeerConnection(config);
    peerConnections[id] = pc;

    // Thiet lap mo ta tu xa (offer)
    await pc.setRemoteDescription(desc);

    // Tao answer va gui lai cho broadcaster
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('answer', id, answer);

    // Khi nhan duoc stream tu broadcaster
    pc.ontrack = e => {
      remoteVideo.srcObject = e.streams[0];
    };

    // Gui ICE candidate cho broadcaster
    pc.onicecandidate = e => {
      if (e.candidate) socket.emit('candidate', id, e.candidate);
    };
  });

  // Khi nhan ICE candidate tu broadcaster
  socket.on('candidate', (id, candidate) => {
    peerConnections[id]?.addIceCandidate(new RTCIceCandidate(candidate));
  });
}
