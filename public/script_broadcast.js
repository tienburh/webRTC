const socket = io();
const peerConnections = {};
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const localVideo = document.getElementById('localVideo');

(async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = stream;
    socket.emit('broadcaster');

    socket.on('watcher', async id => {
      const pc = new RTCPeerConnection(config);
      peerConnections[id] = pc;

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
      peerConnections[id]?.setRemoteDescription(description);
    });

    socket.on('candidate', (id, candidate) => {
      peerConnections[id]?.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on('disconnectPeer', id => {
      peerConnections[id]?.close();
      delete peerConnections[id];
    });
  } catch (err) {
    console.error('getUserMedia error:', err);
    alert('Loi khi truy cap camera: ' + err.name + ' – ' + err.message);
  }
})();