// WebRTC signaling for VOX (Person D).
// Socket.io /vox namespace. Relays SDP offers/answers + ICE candidates + voice_active.
//
// Person D owns the client logic; this is the server relay.

export function setupVoxSignaling(namespace) {
  namespace.on('connection', (socket) => {
    console.log('VOX client connected:', socket.id);

    socket.on('join', (groupId) => {
      socket.join(groupId);
      socket.data.groupId = groupId;
    });

    // Relay SDP offer/answer to a specific peer in the group
    socket.on('sdp', (payload) => {
      socket.to(payload.targetId).emit('sdp', {
        fromId: socket.id,
        sdp: payload.sdp,
      });
    });

    // Relay ICE candidates
    socket.on('ice', (payload) => {
      socket.to(payload.targetId).emit('ice', {
        fromId: socket.id,
        candidate: payload.candidate,
      });
    });

    // Broadcast voice_active to the group
    socket.on('voice_active', (active) => {
      const groupId = socket.data.groupId;
      if (groupId) {
        socket.to(groupId).emit('voice_active', { riderId: socket.id, active });
      }
    });

    socket.on('disconnect', () => {
      console.log('VOX disconnected:', socket.id);
    });
  });
}