// Import các thư viện cần thiết
const express = require('express');
const http = require('http');
const path = require('path');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Phục vụ file tĩnh từ thư mục "public"
app.use(express.static(path.join(__dirname, 'public')));

// Trả về index.html nếu truy cập root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Biến lưu socket ID của broadcaster
let broadcaster = null;

io.on('connection', socket => {
  console.log(`🔌 New connection: ${socket.id}`);

  // Khi broadcaster sẵn sàng
  socket.on('broadcaster', () => {
    broadcaster = socket.id;
    console.log(`🎥 Broadcaster ready: ${broadcaster}`);
    socket.broadcaster.emit('broadcaster'); // thông báo cho watcher
  });

  // Khi viewer kết nối
  socket.on('watcher', () => { 
    console.log(`👀 Watcher connected: ${socket.id}`);
    if (broadcaster) {
      io.to(broadcaster).emit('watcher', socket.id);
    } else {
      console.log('⚠ No broadcaster available');
    }
  });

  // Trao đổi SDP Offer
  socket.on('offer', (id, description) => {
    console.log(`📨 Offer from ${socket.id} to ${id}`);
    socket.to(id).emit('offer', socket.id, description);
  });

  // Trao đổi SDP Answer
  socket.on('answer', (id, description) => {
    console.log(`📨 Answer from ${socket.id} to ${id}`);
    socket.to(id).emit('answer', socket.id, description);
  });

  // Trao đổi ICE Candidate
  socket.on('candidate', (id, candidate) => {
    console.log(`📨 Candidate from ${socket.id} to ${id}`);
    socket.to(id).emit('candidate', socket.id, candidate);
  });

  // Khi client ngắt kết nối
  socket.on('disconnect', () => {
    console.log(`❌ Disconnected: ${socket.id}`);
    if (socket.id === broadcaster) {
      console.log('⚠ Broadcaster disconnected');
      broadcaster = null;
    }

    socket.broadcaster.emit('disconnectPeer', socket.id);
  });
});

// Chạy server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n✅ Server is running! Access it at: https://webrtc-qlql.onrender.com//\n`);
});
