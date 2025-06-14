const socket = io();
const peerConnections = {};
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const localVideo = document.getElementById('localVideo');

window.onload = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  localVideo.srcObject = stream;

  socket.emit('broadcaster');

  socket.on('watcher', async id => {
    const pc = new RTCPeerConnection(config);
    peerConnections[id] = pc;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.onicecandidate = e => {
      if (e.candidate) socket.emit('candidate', id, e.candidate);
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('offer', id, pc.localDescription);
  });

  socket.on('answer', (id, desc) => peerConnections[id]?.setRemoteDescription(desc));
  socket.on('candidate', (id, candidate) => peerConnections[id]?.addIceCandidate(new RTCIceCandidate(candidate)));
  socket.on('disconnectPeer', id => {
    peerConnections[id]?.close();
    delete peerConnections[id];
  });
};
