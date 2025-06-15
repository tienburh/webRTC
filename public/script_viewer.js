const socket = io();
const peerConnections = {};
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

const remoteVideo = document.getElementById('remoteVideo');
const playButton = document.getElementById('playButton');

let receivedStream = null;
let streamReady = false;

// 🔄 Thêm cơ chế retry watcher
let retryCount = 0;
const maxRetries = 5;
const retryWatcher = () => {
  if (retryCount >= maxRetries) return;
  console.log(`⏳ Retry watcher ${retryCount + 1}/${maxRetries}`);
  socket.emit('watcher');
  retryCount++;
  setTimeout(retryWatcher, 2000);
};

socket.on('broadcaster', () => {
  console.log('📡 Broadcaster detected.');
  socket.emit('watcher');
});

retryWatcher(); // bắt đầu retry watcher sau load

socket.on('offer', async (id, description) => {
  console.log('📨 Received offer from broadcaster:', id);

  const pc = new RTCPeerConnection(config);
  peerConnections[id] = pc;

  try {
    await pc.setRemoteDescription(description);
    console.log('🧾 Remote description set.');
  } catch (err) {
    console.error('❌ setRemoteDescription error:', err);
    return;
  }

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  console.log('📤 Sending answer to broadcaster');
  socket.emit('answer', id, pc.localDescription);

  pc.ontrack = event => {
    console.log('📺 Received remote track event.');
    const stream = event.streams[0];
    if (stream) {
      receivedStream = stream;
      remoteVideo.srcObject = receivedStream;
      streamReady = true;
      remoteVideo.play().then(() => {
        console.log('▶️ Video is playing automatically.');
      }).catch(err => {
        console.warn('⚠️ Autoplay failed.', err);
      });
    } else {
      console.warn('⚠️ No stream received!');
    }
  };

  pc.onicecandidate = event => {
    if (event.candidate) {
      console.log('📤 Sending ICE candidate to broadcaster');
      socket.emit('candidate', id, event.candidate);
    }
  };
});

socket.on('candidate', async (id, candidate) => {
  console.log('📥 Received ICE candidate from broadcaster');
  const pc = peerConnections[id];
  if (pc) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('❌ addIceCandidate error:', err);
    }
  }
});

socket.on('disconnectPeer', id => {
  console.log(`❌ Peer disconnected: ${id}`);
  const pc = peerConnections[id];
  if (pc) {
    pc.close();
    delete peerConnections[id];
  }
});

window.addEventListener('DOMContentLoaded', () => {
  if (playButton) {
    playButton.addEventListener('click', () => {
      if (streamReady && receivedStream) {
        remoteVideo.play().then(() => {
          console.log('▶️ Video manually started by user.');
        }).catch(err => {
          console.error('❌ Error playing video:', err);
          alert('Không thể phát video: ' + err.message);
        });
      } else {
        alert('⚠️ Video chưa sẵn sàng! Vui lòng chờ kết nối với Drone.');
      }
    });
  }
});
