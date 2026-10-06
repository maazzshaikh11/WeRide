/**
 * Real Hazard Service (Phase 5).
 * Connects Phase 1–4 core algorithms/storage/sync to Firestore.
 * 
 * - submitHazardReport: creates report, writes to groups/{group_id}/reports/{report_id} or queues offline
 * - triggerClustering: runs DBSCAN (eps=30m, minSamples=2), writes/updates hazards/{cluster_id}
 * - subscribeToHazardReports: realtime listener on groups/{group_id}/reports
 * - subscribeToHazardClusters: realtime listener on hazards (active, by group_id)
 * - resolveHazard: sets status=resolved on hazards/{cluster_id}
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore unresolved when compiled from app context (deps live in module node_modules)
import firestore from '@react-native-firebase/firestore';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { v4: uuidv4 } = require('uuid');
import { HLC } from '../hlc/hlc';
import {
  HazardReport,
  clusterByType,
  calculateCentroid,
  calculateBoundingBox,
  calculateHazardScore,
  haversineDistance,
} from '../dbscan/dbscan';
import {
  queueEnqueue,
  HAZARD_QUEUE,
} from '../crdt/localQueue';
import { isOnline } from '../crdt/syncWorker';

// Firestore paths (frozen per spec)
const HAZARD_REPORTS_COLLECTION = (groupId: string) =>
  `groups/${groupId}/reports`;
const HAZARD_CLUSTERS_COLLECTION = 'hazards';

// Cluster matching threshold: 50 meters centroid proximity
const CLUSTER_MATCH_THRESHOLD_METERS = 50;

function getFirestore(): any {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore Firestore typing differs between module and app compile contexts
  return firestore();
}

export interface HazardCluster {
  cluster_id: string;
  group_id: string;
  hazard_type: 'pothole' | 'oil_spill' | 'accident' | 'debris' | 'other';
  centroid_lat: number;
  centroid_lng: number;
  polygon_points: [number, number][];
  report_count: number;
  hazard_score: number;
  created_at_hlc: string;
  status: 'active' | 'resolved';
}

/**
 * Firestore rejects nested arrays, but the frozen hazard_cluster contract
 * models polygon_points as [lat, lng] pairs. Encode pairs as {lat, lng}
 * maps at the Firestore write boundary and decode back on reads, so the
 * domain model, contract, and map rendering keep working with pairs.
 */
export function encodePolygonPoints(
  points: [number, number][]
): Array<{ lat: number; lng: number }> {
  return points.map(([lat, lng]) => ({ lat, lng }));
}

export function decodePolygonPoints(stored: unknown): [number, number][] {
  if (!Array.isArray(stored)) return [];
  return (stored as Array<[number, number] | { lat: number; lng: number }>).map(
    (p) =>
      Array.isArray(p)
        ? [Number(p[0]), Number(p[1])]
        : [Number((p as { lat?: unknown })?.lat ?? 0), Number((p as { lng?: unknown })?.lng ?? 0)]
  );
}

/**
 * Submit a hazard report.
 *
 * Online: write to Firestore immediately.
 * Offline (or online write fails): enqueue to the local queue — zero data loss.
 *
 * Returns the created report plus whether it was queued instead of written.
 * Callers use `queued` to show the right confirmation ("reported" vs
 * "saved — will sync when you're back online").
 */
export async function submitHazardReport(
  hazardType: HazardCluster['hazard_type'],
  lat: number,
  lng: number,
  riderId: string,
  groupId: string,
  locationTimestampHlc: string
): Promise<{ report: HazardReport; queued: boolean }> {
  const hlc = HLC.fresh();
  const reportId = uuidv4();
  const reportedAtHlc = hlc.now();

  const report: HazardReport = {
    report_id: reportId,
    rider_id: riderId,
    group_id: groupId,
    hazard_type: hazardType,
    lat,
    lng,
    timestamp_hlc: locationTimestampHlc,
    reported_at_hlc: reportedAtHlc,
  };

  const online = await isOnline();

  if (online) {
    try {
      const db = getFirestore();
      await db
        .collection(HAZARD_REPORTS_COLLECTION(groupId))
        .doc(reportId)
        .set(report);
      return { report, queued: false };
    } catch (err) {
      // The connectivity check passed but the write failed (rules denial,
      // network drop mid-write, Firestore outage). Never lose the report:
      // fall through to the offline queue.
      console.warn('[hazardService] Online write failed; queueing report:', err);
    }
  }

  enqueueHazardReport(report, reportedAtHlc);
  return { report, queued: true };
}

/** Enqueue a hazard report for later sync (offline path + online-write fallback). */
function enqueueHazardReport(report: HazardReport, reportedAtHlc: string): void {
  const operation = {
    id: uuidv4(),
    type: 'hazard_report' as const,
    data: report,
    created_at_hlc: reportedAtHlc,
    retry_count: 0,
  };
  queueEnqueue(HAZARD_QUEUE, operation);
}

/**
 * Trigger DBSCAN clustering for a group.
 * Reads all reports for the group from Firestore, clusters them,
 * and writes/updates hazard clusters to Firestore hazards/{cluster_id}.
 * Uses eps=30m, minSamples=2 per spec.
 */
export async function triggerClustering(groupId: string): Promise<void> {
  const db = getFirestore();

  // Fetch all reports for this group
  const reportsSnapshot = await db
    .collection(HAZARD_REPORTS_COLLECTION(groupId))
    .get();

  if (reportsSnapshot.empty) {
    return;
  }

  const reports: HazardReport[] = [];
  for (const doc of reportsSnapshot.docs) {
    const data = doc.data();
    reports.push({
      report_id: data.report_id,
      rider_id: data.rider_id,
      group_id: data.group_id,
      hazard_type: data.hazard_type,
      lat: data.lat,
      lng: data.lng,
      timestamp_hlc: data.timestamp_hlc,
      reported_at_hlc: data.reported_at_hlc,
    });
  }

  // Run DBSCAN clustering (Phase 3 implementation)
  const clusters = clusterByType(reports, 30, 2);

  // Fetch existing active clusters for this group to match/update
  const existingClustersSnapshot = await db
    .collection(HAZARD_CLUSTERS_COLLECTION)
    .where('group_id', '==', groupId)
    .where('status', '==', 'active')
    .get();

  const existingClusters = new Map<string, HazardCluster>();
  for (const doc of existingClustersSnapshot.docs) {
    const data = doc.data() as HazardCluster;
    existingClusters.set(doc.id, data);
  }

  const hlc = HLC.fresh();
  const nowHlc = hlc.now();
  const batch = db.batch();

  for (const cluster of clusters) {
    const hazardType = cluster.reports[0].hazard_type as HazardCluster['hazard_type'];
    const centroid = calculateCentroid(cluster.reports);
    const bbox = calculateBoundingBox(cluster.reports);
    const latestReportTime = Math.max(...cluster.reports.map(r =>
      // Canonical HLC form is "physical:counter"; HLC.parse also accepts the
      // legacy dash form, so this is robust to old queued reports.
      HLC.parse(r.reported_at_hlc).physical
    ));
    const hazardScore = calculateHazardScore(cluster.reports.length, latestReportTime);

    // Try to match with existing cluster by centroid proximity
    let matchedClusterId: string | null = null;
    for (const [existingId, existingCluster] of existingClusters) {
      if (existingCluster.hazard_type !== hazardType) continue;
      const dist = haversineDistance(
        centroid.lat,
        centroid.lng,
        existingCluster.centroid_lat,
        existingCluster.centroid_lng
      );
      if (dist <= CLUSTER_MATCH_THRESHOLD_METERS) {
        matchedClusterId = existingId;
        break;
      }
    }

    const clusterId = matchedClusterId ?? uuidv4();
    const isNewCluster = !matchedClusterId;

    const clusterData: HazardCluster = {
      cluster_id: clusterId,
      group_id: groupId,
      hazard_type: hazardType,
      centroid_lat: centroid.lat,
      centroid_lng: centroid.lng,
      // Firestore-safe encoding of the [lat, lng] pairs (nested arrays are
      // rejected by Firestore); decoded back to pairs on read.
      polygon_points: encodePolygonPoints(bbox) as unknown as [number, number][],
      report_count: cluster.reports.length,
      hazard_score: hazardScore,
      created_at_hlc: isNewCluster ? nowHlc : existingClusters.get(clusterId)!.created_at_hlc,
      status: 'active',
    };

    const ref = db.collection(HAZARD_CLUSTERS_COLLECTION).doc(clusterId);
    batch.set(ref, clusterData);

    // Remove from existing so we don't try to match again
    if (matchedClusterId) {
      existingClusters.delete(matchedClusterId);
    }
  }

  // Optionally: resolve unmatched existing clusters that no longer have reports
  // (For MVP, we leave them as-is; they can be resolved manually via resolveHazard)

  await batch.commit();
}

/**
 * Subscribe to hazard reports for a group.
 * Updates local cache and triggers clustering on changes.
 * Returns Firestore unsubscribe function.
 */
export function subscribeToHazardReports(
  groupId: string,
  callback: (reports: HazardReport[]) => void
): () => void {
  const db = getFirestore();
  let isFirstLoad = true;

  const unsubscribe = db
    .collection(HAZARD_REPORTS_COLLECTION(groupId))
    .onSnapshot(
      (snapshot: any) => {
        const reports: HazardReport[] = [];
        for (const doc of snapshot.docs) {
          const data = doc.data();
          reports.push({
            report_id: data.report_id,
            rider_id: data.rider_id,
            group_id: data.group_id,
            hazard_type: data.hazard_type,
            lat: data.lat,
            lng: data.lng,
            timestamp_hlc: data.timestamp_hlc,
            reported_at_hlc: data.reported_at_hlc,
          });
        }
        callback(reports);

        // Trigger clustering after initial load and on subsequent changes
        // Avoid triggering on the very first load if it would cause duplicate work
        if (!isFirstLoad) {
          triggerClustering(groupId).catch((err: any) => {
            console.error('[hazardService] Clustering trigger failed:', err);
          });
        }
        isFirstLoad = false;
      },
      (error: any) => {
        console.error('[hazardService] Hazard reports listener error:', error);
      }
    );

  return unsubscribe;
}

/**
 * Subscribe to active hazard clusters for a group.
 * Filters by group_id and status=active.
 * Returns Firestore unsubscribe function.
 */
export function subscribeToHazardClusters(
  groupId: string,
  callback: (clusters: HazardCluster[]) => void
): () => void {
  const db = getFirestore();

  const unsubscribe = db
    .collection(HAZARD_CLUSTERS_COLLECTION)
    .where('group_id', '==', groupId)
    .where('status', '==', 'active')
    .onSnapshot(
      (snapshot: any) => {
        const clusters: HazardCluster[] = [];
        for (const doc of snapshot.docs) {
          const data = doc.data() as HazardCluster;
          // Decode the Firestore-safe {lat, lng} encoding back to pairs.
          data.polygon_points = decodePolygonPoints(data.polygon_points);
          clusters.push(data);
        }
        callback(clusters);
      },
      (error: any) => {
        console.error('[hazardService] Hazard clusters listener error:', error);
      }
    );

  return unsubscribe;
}

/**
 * Resolve a hazard cluster.
 * Sets status=resolved on hazards/{cluster_id}.
 * Does not delete the document.
 */
export async function resolveHazard(clusterId: string): Promise<void> {
  const db = getFirestore();

  await db
    .collection(HAZARD_CLUSTERS_COLLECTION)
    .doc(clusterId)
    .update({
      status: 'resolved',
      // Optionally track resolved_at_hlc if contract adds it
    });
}