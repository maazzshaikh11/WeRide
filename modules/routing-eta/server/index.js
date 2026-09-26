import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';

import { handleRoute } from './astar.js';
import { handleFlSubmit, handleFlGlobal } from './fl_proxy.js';
import { setupVoxSignaling } from './vox_signaling.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Routing/ETA API (Person C)
app.post('/route', handleRoute);

// FL aggregation proxy (Person D — proxies to Python sidecar if used)
app.post('/fl/submit', handleFlSubmit);
app.get('/fl/global', handleFlGlobal);

const server = http.createServer(app);

// WebRTC signaling for VOX (Person D)
const io = new Server(server, { cors: { origin: '*' } });
setupVoxSignaling(io.of('/vox'));

// Live location fan-out (Person A).
// Clients join a per-group room; location:update payloads are validated and
// rebroadcast to everyone else in the room. The sender does not receive its
// own echo (socket.to excludes the sender).
const GROUP_ROOM = (groupId) => `group:${groupId}`;

function isValidLocationPayload(p) {
  return (
    p != null &&
    typeof p === 'object' &&
    typeof p.rider_id === 'string' && p.rider_id.length > 0 &&
    typeof p.group_id === 'string' && p.group_id.length > 0 &&
    typeof p.timestamp_hlc === 'string' && p.timestamp_hlc.length > 0 &&
    typeof p.lat === 'number' && Number.isFinite(p.lat) &&
    typeof p.lng === 'number' && Number.isFinite(p.lng)
  );
}

io.on('connection', (socket) => {
  socket.on('join-group', (msg) => {
    const groupId = typeof msg === 'string' ? msg : msg?.groupId;
    if (typeof groupId === 'string' && groupId.length > 0) {
      socket.join(GROUP_ROOM(groupId));
    }
  });

  socket.on('leave-group', (msg) => {
    const groupId = typeof msg === 'string' ? msg : msg?.groupId;
    if (typeof groupId === 'string' && groupId.length > 0) {
      socket.leave(GROUP_ROOM(groupId));
    }
  });

  socket.on('location:update', (payload) => {
    if (!isValidLocationPayload(payload)) {
      // Malformed payloads are dropped, never forwarded.
      return;
    }
    socket.to(GROUP_ROOM(payload.group_id)).emit('location:update', payload);
  });
});

const PORT = process.env.PORT || 3000;
// Exported for tests (node --test). The listener only starts outside tests.
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => console.log(`WeRide server on :${PORT}`));
}

export { app, server, io };