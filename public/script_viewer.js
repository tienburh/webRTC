const socket = io();
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const peerConnection = new RTCPeerConnection(config);

const remoteVideo = document.getElementById("remoteVideo");

peerConnection.ontrack = (event) => {
  if (remoteVideo.srcObject !== event.streams[0]) {
    remoteVideo.srcObject = event.streams[0];
  }
};

peerConnection.onicecandidate = (event) => {
  if (event.candidate) {
    socket.emit("candidate", {
      id: socket.id,
      candidate: event.candidate,
    });
  }
};

socket.on("connect", () => {
  socket.emit("watcher");
});

socket.on("offer", async (data) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(data.description));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit("answer", {
    id: data.id,
    description: peerConnection.localDescription
  });
});

socket.on("candidate", (data) => {
  peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
});

window.onbeforeunload = () => socket.close();
