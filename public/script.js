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

    // Gửi broadcaster signal lên server
    socket.emit('broadcaster');

    // Cập nhật các peer connections (nếu có)
    Object.values(peerConnections).forEach(pc => {
      // Xóa các track cũ nếu có
      pc.getSenders().forEach(sender => pc.removeTrack(sender));

      // Thêm các track mới
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    });

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
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  localVideo.srcObject = null;
  isStreaming = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;

  console.log('Streaming stopped');
}

// Xử lý Start button
startBtn.addEventListener('click', startStreaming);

// Xử lý Stop button
stopBtn.addEventListener('click', () => {
  stopStreaming();
  // Đóng các peer connection
  Object.values(peerConnections).forEach(pc => pc.close());
  for (const id in peerConnections) delete peerConnections[id];
  // Reload trang để reset toàn bộ trạng thái
  window.location.reload();
});

// Khi có viewer kết nối
socket.on('watcher', async id => {
  console.log('Watcher connected:', id);
  const pc = new RTCPeerConnection(config);
  peerConnections[id] = pc;

  if (!localStream) {
    console.warn('No local stream, cannot add tracks');
    return;
  }

  // Thêm track từ local stream vào peer connection
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

// Nhận answer từ viewer
socket.on('answer', (id, description) => {
  console.log('Received answer from', id);
  peerConnections[id]?.setRemoteDescription(description);
});

// Nhận candidate từ viewer
socket.on('candidate', (id, candidate) => {
  peerConnections[id]?.addIceCandidate(new RTCIceCandidate(candidate));
});

// Viewer ngắt kết nối
socket.on('disconnectPeer', id => {
  console.log('Viewer disconnected:', id);
  peerConnections[id]?.close();
  delete peerConnections[id];
});

// --- XỬ LÝ TAB VISIBILITY ---

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    console.log('Tab active again');
    if (!isStreaming) {
      startStreaming();
    }
  } else {
    console.log('Tab hidden, stop streaming');
    stopStreaming();
  }
});
