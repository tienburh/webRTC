const socket = io();
const peerConnections = {};
const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};
const localVideo = document.getElementById('localVideo');

window.onload = async () => {
  console.log('📷 Auto-start streaming on page load');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    console.log('✅ Camera stream acquired');
    localVideo.srcObject = stream;

    socket.emit('broadcaster');

    socket.on('watcher', async id => {
      console.log('📡 Watcher connected:', id);
      const pc = new RTCPeerConnection(config);
      peerConnections[id] = pc;

      // Add tracks and log
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
      console.log('🎙️ Tracks added to peer connection:', pc.getSenders());

      pc.onicecandidate = event => {
        if (event.candidate) {
          socket.emit('candidate', id, event.candidate);
        }
      };

      // Optional: Wait ICE gathering complete before sending offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await new Promise(resolve => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          const checkState = () => {
            if (pc.iceGatheringState === 'complete') {
              pc.removeEventListener('icegatheringstatechange', checkState);
              resolve();
            }
          };
          pc.addEventListener('icegatheringstatechange', checkState);
        }
      });

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

  } catch (err) {
    console.error('❌ getUserMedia error:', err);
    alert('Lỗi khi truy cập camera: ' + err.name + ' – ' + err.message);
  }
};
