# Person B — Hazard Detection + Offline SOS

DBSCAN hazard clustering + CRDT (OR-Set) offline-resilient SOS + HLC clock (shared util).

## DBSCAN parameters (tune in Week 2-3, document final values here)
| Param | Value | Notes |
|---|---|---|
| eps | 30m | neighborhood radius |
| min_samples | 2 | min reports to form a cluster |
| Cluster by | hazard_type | separate clustering per type |

## HLC
- Algorithm: Kulkarni et al. (counter + physical_time)
- Persist `l` on every update — app restart must not reset HLC
- Consumed by A (location timestamps), C (route recalculated_at_hlc), D (FL rounds optional)

## CRDT (SOS)
- OR-Set with tombstone on resolve
- Local queue: MMKV box 'sos_queue' → Firestore batch write on reconnect
- Zero data loss: local write before UI confirms SOS

## FCM trigger
- Cloud Function on sos_events/ write → sends FCM push to group members
- TODO: deploy Cloud Function (coordinate with infra)

## hazard_score formula
score = min(1.0, reportCount / 5) * recencyDecay

## polygon_points
- Bounding box (4 points) for MVP. Convex hull if visual fidelity demanded.

## See also
- Plan: `Person_B_Hazard_SOS.md`
- Contracts: `contracts/hazard_cluster.json`, `contracts/sos_event.json`, `contracts/hazard_report.json`