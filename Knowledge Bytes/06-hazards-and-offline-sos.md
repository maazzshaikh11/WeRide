---
### Byte 6: Hazards and offline-safe SOS
*Builds on:* Byte 4 (Firestore collections and the push Cloud Function)

*In plain terms:*
The **hazard-sos** module does two things. **Hazards:** riders report potholes, spills etc.; the module only raises an alert once **two matching reports** agree, so one bad tap can't cry wolf. **SOS:** a rider's emergency alert must be delivered *even with no signal* — it is saved on the phone first, then sent, and it never gets lost or duplicated.

*The code:*
```ts
// dbscan.ts — hazards: cluster same-type reports within 30 m, need at least 2
export function clusterByType(reports, eps = 30, minSamples = 2) { /* DBSCAN */ }
```
```ts
// sosService.ts — "local first, network second"
localSet = orSetAdd(localSet, sosElement, hlc);
orSetSave(localSet, storageKey);                 // durable on the phone BEFORE any network
if (online) { await firestore().collection('sos_events').doc(sosId).set(...) }
else        { queueEnqueue(SOS_QUEUE, operation) }   // retried until it succeeds
```

*How it fits together:*
- **DBSCAN** groups reports of the same `hazard_type` that are within 30 m; a group of ≥ 2 becomes a `hazard_cluster` (with a centroid and score) in Firestore `hazards/`. Clusters feed both the Alerts tab and the routing penalty (Byte 5). A "Mark resolved" action closes one.
- **HLC (Hybrid Logical Clock)** is a timestamp `"physical:counter"` that stays ordered across phones whose clocks disagree. Everything queued or published carries one.
- **`localQueue`** is an MMKV-backed FIFO that survives app restarts. Retries are intentionally uncapped — a retry limit would break the zero-loss promise.
- **OR-Set CRDT** (*observed-remove set*) represents active SOS events: adding inserts a uniquely-tagged element; resolving adds a **tombstone** for it. Merging two copies is a union of adds minus a union of tombstones, so devices converge to the same answer in any order.
- **`syncWorker`** watches connectivity (NetInfo); when the phone goes offline → online it flushes the queues and merges local with remote SOS state. Writes use the event's id as the Firestore document id, so a retry just overwrites itself (**idempotent**).

*Why it is designed this way:* SOS is the one feature where "it worked on my signal" is not acceptable. Making the local write the *first* step means the UI can confirm instantly while delivery catches up.

*Gotcha:* the 2-report rule means a *first* hazard report alone shows nothing to the crew — by design, and the UI says so.
