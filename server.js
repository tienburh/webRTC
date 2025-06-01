// Import các thư viện cần thiết
const express  = require('express');
const http     = require('http');
const path     = require('path');
const socketIO = require('socket.io');

const app    = express(); //Tạo ứng dụng Express.
const server = http.createServer(app); //Tạo HTTP server từ Express
const io     = socketIO(server); //Khởi tạo Socket.IO để gắn với HTTP server (giúp giao tiếp WebSocket giữa client và server).


// Serve các file tĩnh trong thư mục "public"
app.use(express.static(path.join(__dirname, 'public')));

// Đường dẫn chính trả về index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


let broadcaster;  // Lưu lại socket ID của broadcaster hiện tại

io.on('connection', socket => {
  console.log(`🔌 New connection: ${socket.id}`);

  socket.on('broadcaster', () => {
    broadcaster = socket.id;  // Lưu socket ID của broadcaster
    console.log(`🎥 Broadcaster ready: ${broadcaster}`);

    // Gửi thông báo cho tất cả các watcher đang kết nối rằng broadcaster đã sẵn sàng
    socket.broadcast.emit('broadcaster');
  });


  socket.on('watcher', () => {
    console.log(`👀 Watcher connected: ${socket.id}`);
    if (broadcaster) {
      // Gửi sự kiện đến broadcaster với ID của watcher
      io.to(broadcaster).emit('watcher', socket.id);
    } else {
      console.log('⚠ No broadcaster found when watcher connected.');
    }
  });


  socket.on('offer', (id, description) => {
    console.log(`📨 Offer from ${socket.id} to ${id}`);
    socket.to(id).emit('offer', socket.id, description);
  });

  socket.on('answer', (id, description) => {
    console.log(`📨 Answer from ${socket.id} to ${id}`);
    socket.to(id).emit('answer', socket.id, description);
  });

  socket.on('candidate', (id, candidate) => {
    console.log(`📨 ICE candidate from ${socket.id} to ${id}`);
    socket.to(id).emit('candidate', socket.id, candidate);
  });

  socket.on('disconnect', () => {
    console.log(`❌ Disconnected: ${socket.id}`);

    // Nếu broadcaster rời đi, reset biến
    if (socket.id === broadcaster) {
      broadcaster = null;
      console.log('⚠ Broadcaster disconnected.');
    }

    // Thông báo cho các client còn lại rằng một peer đã rời khỏi
    socket.broadcast.emit('disconnectPeer', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n✅ Server is running! Access it at: https://webrtc-qlql.onrender.com//\n`);
});
