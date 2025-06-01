const socket = io();
const peerConnections = {};
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const joinBtn = document.getElementById('joinBtn');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

let flippedStream = null;

// --- Broadcaster ---
if (startBtn) {
  startBtn.addEventListener('click', async () => {
    try {
      const originalStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

      const hiddenVideo = document.createElement('video');
      hiddenVideo.srcObject = originalStream;
      hiddenVideo.muted = true;
      hiddenVideo.playsInline = true;
      await hiddenVideo.play();

      await new Promise(resolve => {
        hiddenVideo.onloadedmetadata = () => {
          resolve();
        };
      });

      const canvas = document.createElement('canvas');
      canvas.width = hiddenVideo.videoWidth;
      canvas.height = hiddenVideo.videoHeight;
      const ctx = canvas.getContext('2d');

      function draw() {
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(-1, 1); // flip horizontal
        ctx.drawImage(hiddenVideo, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();
        requestAnimationFrame(draw);
      }
      draw();

      flippedStream = canvas.captureStream(30);
      originalStream.getAudioTracks().forEach(track => flippedStream.addTrack(track));

      localVideo.srcObject = flippedStream;
      localVideo.classList.remove('hidden');

      socket.emit('broadcaster');

      startBtn.disabled = true;
      stopBtn.disabled = false;
    } catch (err) {
      console.error('getUserMedia error:', err);
      alert('Error accessing camera: ' + err.message);
    }
  });

  stopBtn?.addEventListener('click', () => window.location.reload());

  socket.on('watcher', async id => {
    const pc = new RTCPeerConnection(config);
    peerConnections[id] = pc;

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
    peerConnections[id]?.setRemoteDescription(description);
  });

  socket.on('candidate', (id, candidate) => {
    peerConnections[id]?.addIceCandidate(new RTCIceCandidate(candidate));
  });

  socket.on('disconnectPeer', id => {
    peerConnections[id]?.close();
    delete peerConnections[id];
  });
}

// --- Viewer ---
if (joinBtn) {
  joinBtn.addEventListener('click', () => {
    socket.emit('watcher');
    remoteVideo.classList.remove('hidden');
  });

  socket.on('offer', async (id, desc) => {
    const pc = new RTCPeerConnection(config);
    peerConnections[id] = pc;

    await pc.setRemoteDescription(desc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('answer', id, answer);

    pc.ontrack = e => {
      if (!remoteVideo.srcObject) {
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
