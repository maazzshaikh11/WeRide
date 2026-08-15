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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`WeRide server on :${PORT}`));