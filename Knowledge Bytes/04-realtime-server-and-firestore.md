---
### Byte 4: Two data channels — a fast live socket and a durable database
*Builds on:* Byte 3 (this is where the published locations travel)

*In plain terms:*
WeRide moves data over **two channels with different jobs**. A small **Node.js server** relays *ephemeral, high-frequency* things (positions, quick signals) over **Socket.io**. **Firebase Firestore** stores *durable* things (groups, last-known positions, hazards, SOS events) and enforces who may read or write them.

*The code:*
```js
// modules/routing-eta/server/index.js — rooms, one per group
io.on('connection', (socket) => {
  socket.on('join-group', (msg) => socket.join(GROUP_ROOM(msg.groupId)));
  socket.on('location:update', (payload) => {
    if (!isValidLocationPayload(payload)) return;               // malformed: dropped
    socket.to(GROUP_ROOM(payload.group_id)).emit('location:update', payload); // not to sender
  });
  socket.on('signal:send', /* validated, relayed as 'signal:received' */);
});
```

*How it fits together:*
| | Socket.io server | Firestore |
|---|---|---|
| **Used for** | live `location:update`, quick signals (*Wait up / Pull over / All good / Need fuel*) | `groups`, `groups/{id}/locations`, `groups/{id}/reports`, `hazards`, `sos_events` |
| **Nature** | instant, in memory, forgotten on disconnect | persistent, queryable, works across sessions |
| **Guards** | payload validation, group-room membership, label allow-list | `firestore.rules` (see below) |

- The **same Node process** also hosts `POST /route` (Byte 5), the federated-learning proxy (`/fl/*`) and the WebRTC signalling namespace (`/vox`).
- **Firestore rules** are the security layer: any signed-in user can read; a rider may write only their own `locations/{riderId}`; a member may leave or update a group; `routes/` and `fl_rounds/` are server-write-only.
- **A Cloud Function** (`infra/firebase/functions`) listens for new `sos_events` documents and sends a push notification to every other group member's saved device token.

*Why it is designed this way:* writing every position to Firestore at 1 Hz would be slow and costly, so the socket carries the firehose and Firestore only gets a throttled copy. Conversely SOS must never be lost, so it goes to Firestore (with an offline queue — Byte 6).

*Gotcha:* the socket is **not** the source of truth. If you join late or reconnect, positions come from the Firestore `locations` seed first, then the socket takes over.
