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

  // Khi nhan Start
  startBtn.addEventListener('click', async () => {
    console.log('>> Start clicked');
    try {
      // Yeu cau quyen truy cap camera va micro
      console.log('>> Requesting camera...');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      console.log('<< Camera OK:', stream);

      // Hien thi luong video local
      localVideo.srcObject = stream;

      // Gui thong bao len server la nguoi dung nay la broadcaster
      socket.emit('broadcaster');

      // Vo hieu hoa nut Start, bat nut Stop
      startBtn.disabled = true;
      stopBtn.disabled = false;
    } catch (err) {
      console.error('❌ getUserMedia error:', err);
      alert('Loi khi truy cap camera: ' + err.name + ' – ' + err.message);
    }
  });

  // Khi nhan Stop thi reload lai trang
  stopBtn?.addEventListener('click', () => window.location.reload());

  // Khi co viewer ket noi (server gui ve socket ID cua viewer)
  socket.on('watcher', async id => {
    console.log('📡 Watcher connected:', id);

    // Tao peer connection moi cho viewer
    const pc = new RTCPeerConnection(config);
    peerConnections[id] = pc;

    // Them track tu stream local vao peer connection
    const stream = localVideo.srcObject;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    // Gui ICE candidate cho viewer
    pc.onicecandidate = event => {
      if (event.candidate) {
        socket.emit('candidate', id, event.candidate);
      }
    };

    // Tao offer va gui cho viewer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('offer', id, pc.localDescription);
  });

  // Khi nhan answer tu viewer
  socket.on('answer', (id, description) => {
    console.log('📨 Received answer from', id);
    peerConnections[id]?.setRemoteDescription(description);
  });

  // Khi nhan ICE candidate tu viewer
  socket.on('candidate', (id, candidate) => {
    console.log('📨 Received ICE candidate from', id);
    peerConnections[id]?.addIceCandidate(new RTCIceCandidate(candidate));
  });

  // Khi viewer ngat ket noi
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
