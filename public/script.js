const socket = io();
const peerConnections = {};
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

const localVideo = document.getElementById('localVideo');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');

let localStream = null;
let isStreaming = false;

async function startStreaming() {
  if (isStreaming) return;
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    localVideo.play();

    socket.emit('broadcaster');

    isStreaming = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;

    console.log('Streaming started');
  } catch (err) {
    console.error('Error accessing camera/microphone:', err);
    alert('Lỗi khi truy cập camera/microphone: ' + err.message);
  }
}

function stopStreaming() {
  if (!isStreaming) return;
  if (localStream) {
    // Không tắt track khi dừng stream nữa để tránh mất stream khi chuyển tab
    // localStream.getTracks().forEach(track => track.stop());
    // Thay vào đó chỉ tắt video local, các peer connection vẫn giữ
    localVideo.pause();
    localVideo.srcObject = null;
    // Nhưng bạn có thể tắt track khi stop thực sự (ví dụ reload trang)
  }
  localStream = null;
  isStreaming = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;

  console.log('Streaming stopped');
}

startBtn.addEventListener('click', startStreaming);

stopBtn.addEventListener('click', () => {
  stopStreaming();
  Object.values(peerConnections).forEach(pc => pc.close());
  for (const id in peerConnections) delete peerConnections[id];
  window.location.reload();
});

socket.on('watcher', async id => {
  console.log('Watcher connected:', id);
  const pc = new RTCPeerConnection(config);
  peerConnections[id] = pc;

  if (!localStream) {
    console.warn('No local stream, cannot add tracks');
    return;
  }

  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

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
  console.log('Received answer from', id);
  peerConnections[id]?.setRemoteDescription(description);
});

socket.on('candidate', (id, candidate) => {
  peerConnections[id]?.addIceCandidate(new RTCIceCandidate(candidate));
});

socket.on('disconnectPeer', id => {
  console.log('Viewer disconnected:', id);
  peerConnections[id]?.close();
  delete peerConnections[id];
});

// XỬ LÝ TAB VISIBILITY
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    console.log('Tab active');
    // Resume video nếu có stream
    if (localVideo && isStreaming) {
      localVideo.play().catch(e => console.warn('Error resume video:', e));
    }
  } else {
    console.log('Tab hidden');
    // Pause video local, giữ stream và peer connections
    if (localVideo && isStreaming) {
      localVideo.pause();
      console.log('Video paused due to tab hidden');
    }
  }
});
