const socket = io();   
const peerConnections = {};
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// Tham chiếu DOM
const localVideo  = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startBtn    = document.getElementById('startBtn');
const stopBtn     = document.getElementById('stopBtn');
const joinBtn     = document.getElementById('joinBtn');

// --- BROADCASTER ---
if (startBtn) {
  console.log('▶ Found startBtn, attaching handler');
  startBtn.addEventListener('click', async () => {
    console.log('>> Start clicked');
    try {
      console.log('>> Requesting camera...');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      console.log('<< Camera OK:', stream);
      localVideo.srcObject = stream;
      socket.emit('broadcaster');
      startBtn.disabled = true;
      stopBtn.disabled = false;
    } catch (err) {
      console.error('❌ getUserMedia error:', err);
      alert('Lỗi khi truy cập camera: ' + err.name + ' – ' + err.message);
    }
  });

  stopBtn?.addEventListener('click', () => window.location.reload());

  // 🔥 Bổ sung: Gửi offer cho viewer khi họ kết nối
  socket.on('watcher', async id => {
    console.log('📡 Watcher connected:', id);
    const pc = new RTCPeerConnection(config);
    peerConnections[id] = pc;

    const stream = localVideo.srcObject;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

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

// --- VIEWER ---
if (joinBtn) {
  joinBtn.addEventListener('click', () => socket.emit('watcher'));

  socket.on('offer', async (id, desc) => {
    const pc = new RTCPeerConnection(config);
    peerConnections[id] = pc;
    await pc.setRemoteDescription(desc);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('answer', id, answer);

    pc.ontrack = e => {
      remoteVideo.srcObject = e.streams[0];
    };
    pc.onicecandidate = e => {
      if (e.candidate) socket.emit('candidate', id, e.candidate);
    };
  })
  socket.on('candidate', (id, candidate) => {
    peerConnections[id]?.addIceCandidate(new RTCIceCandidate(candidate));
  });
}
