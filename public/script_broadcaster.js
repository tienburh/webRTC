// Tạo kết nối socket.io tới signaling server
const socket = io();

// Đối tượng lưu danh sách các kết nối peer với mỗi viewer, key là socket ID
const peerConnections = {};

// Cấu hình ICE server (sử dụng STUN server của Google để hỗ trợ NAT traversal)
const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// Lấy phần tử video trong HTML để hiển thị video local (phía drone)
const localVideo = document.getElementById('localVideo');
// Khi trang web load xong, bắt đầu streaming
window.onload = async () => {
  console.log('📷 Auto-start streaming on page load');

  try {
    // Yêu cầu quyền truy cập camera (chỉ video, không lấy audio)
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    console.log('✅ Camera stream acquired');

    // Gán luồng camera vào thẻ video local để hiển thị hình ảnh tại giao diện broadcaster
    localVideo.srcObject = stream;

    // Gửi thông báo tới signaling server rằng mình là broadcaster
    socket.emit('broadcaster');
    // Khi nhận được yêu cầu từ một viewer (watcher)
    socket.on('watcher', async id => {
      console.log('📡 Watcher connected:', id);

      // Tạo kết nối WebRTC mới cho viewer này
      const pc = new RTCPeerConnection(config);
      peerConnections[id] = pc;

      // Thêm tất cả track (video) từ luồng local vào peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
      console.log('🎙️ Tracks added to peer connection:', pc.getSenders());
      // Khi ICE candidate được tạo (thông tin mạng), gửi đến viewer thông qua signaling server
      pc.onicecandidate = event => {
        if (event.candidate) {
          socket.emit('candidate', id, event.candidate);
        }
      };
      // Tạo offer SDP từ phía broadcaster
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Đợi cho quá trình ICE gathering hoàn tất trước khi gửi offer
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

      // Gửi offer tới viewer thông qua signaling server
      socket.emit('offer', id, pc.localDescription);
    });
    // Khi nhận được answer từ viewer, đặt remote description vào peer connection
    socket.on('answer', (id, description) => {
      console.log('📨 Received answer from', id);
      peerConnections[id]?.setRemoteDescription(description);
    });
    // Khi nhận ICE candidate từ viewer, thêm vào peer connection tương ứng
    socket.on('candidate', (id, candidate) => {
      console.log('📨 Received ICE candidate from', id);
      peerConnections[id]?.addIceCandidate(new RTCIceCandidate(candidate));
    });
    // Khi viewer ngắt kết nối, đóng kết nối peer tương ứng và xóa khỏi danh sách
    socket.on('disconnectPeer', id => {
      console.log('❌ Viewer disconnected:', id);
      peerConnections[id]?.close();
      delete peerConnections[id];
    });
  } catch (err) {
    // Nếu xảy ra lỗi khi lấy camera, hiển thị lỗi ra console và báo cho người dùng
    console.error('❌ getUserMedia error:', err);
    alert('Lỗi khi truy cập camera: ' + err.name + ' – ' + err.message);
  }
};
