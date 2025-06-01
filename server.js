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

  startBtn.addEventListener('click', async () => {
    console.log('>> Start clicked');
    try {
      console.log('>> Requesting camera...');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      console.log('<< Camera OK:', stream);

      // Lấy track video gốc
      const videoTrack = stream.getVideoTracks()[0];

      // Tạo video ẩn để phát video gốc (không thêm vào DOM)
      const hiddenVideo = document.createElement('video');
      hiddenVideo.srcObject = new MediaStream([videoTrack]);
      hiddenVideo.muted = true;

      // Tạo canvas để vẽ video đã lật ngang
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Chờ video metadata load xong và video bắt đầu play
      hiddenVideo.addEventListener('loadedmetadata', async () => {
        canvas.width = hiddenVideo.videoWidth;
        canvas.height = hiddenVideo.videoHeight;

        try {
          await hiddenVideo.play();
          console.log('Hidden video playing');
        } catch(err) {
          console.warn('Could not autoplay hidden video:', err);
        }

        // Hàm vẽ liên tục video đã lật ngang lên canvas
        function draw() {
          ctx.save();
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);

          ctx.drawImage(hiddenVideo, 0, 0, canvas.width, canvas.height);
          ctx.restore();

          requestAnimationFrame(draw);
        }
        draw();
      });

      // Tạo stream từ canvas
      const canvasStream = canvas.captureStream(30); // fps 30

      // Thêm track audio từ stream gốc vào canvasStream (nếu có)
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        canvasStream.addTrack(audioTracks[0]);
      }

      // Hiển thị stream canvas (đã lật) lên video local
      localVideo.srcObject = canvasStream;

      // Gửi thông báo lên server là broadcaster
      socket.emit('broadcaster');

      // Lưu stream đã lật để dùng cho peer connection
      window._broadcastStream = canvasStream;

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

  // Khi có viewer kết nối (server gửi socket ID của viewer)
  socket.on('watcher', async id => {
    console.log('📡 Watcher connected:', id);

    // Tạo peer connection mới cho viewer
    const pc = new RTCPeerConnection(config);
    peerConnections[id] = pc;

    // Lấy stream đã lật ngang
    const stream = window._broadcastStream;
    if (!stream) {
      console.warn('⚠️ No broadcast stream found!');
      return;
    }

    // Thêm các track của stream vào peer connection
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

// --- Viewer ---
if (joinBtn) {
  joinBtn.addEventListener('click', () => {
    socket.emit('watcher');
  });

  socket.on('offer', async (id, desc) => {
    const pc = new RTCPeerConnection(config);
    peerConnections[id] = pc;

    await pc.setRemoteDescription(desc);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('answer', id, answer);

    pc.ontrack = e => {
      if (remoteVideo) {
        remoteVideo.srcObject = e.streams[0];
      }
    };

    pc.onicecandidate = e => {
      if (e.candidate) socket.emit('candidate', id, e.candidate);
    };
  });

  socket.on('candidate', (id, candidate) => {
    peerConnections[id]?.addIceCandidate(new RTCIceCandidate(candidate));
  });
}
