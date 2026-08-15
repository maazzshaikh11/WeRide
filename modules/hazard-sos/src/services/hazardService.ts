/**
 * Hazard submission + DBSCAN clustering + Firestore publish.
 * Ported from hazard_service.dart.
 *
 * On new report:
 * 1. Write hazard_report to local queue (offline-first)
 * 2. Run DBSCAN over reports for this group+hazard_type
 * 3. Publish/update hazard_cluster to Firestore hazards/{cluster_id}
 */

import firestore from '@react-native-firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { HLC } from '../hlc/hlc';
import { HazardReport, dbscanByType } from '../dbscan/dbscan';

export class HazardService {
  private _firestore: ReturnType<typeof firestore>;
  private _hlc: HLC;
  private _uuid = uuidv4;

  constructor(hlc: HLC, firestoreInstance?: ReturnType<typeof firestore>) {
    this._hlc = hlc;
    this._firestore = firestoreInstance ?? firestore();
  }

  async reportHazard(params: {
    riderId: string;
    groupId: string;
    hazardType: HazardReport['hazardType'];
    lat: number;
    lng: number;
    locationTimestampHlc: string;
  }): Promise<void> {
    const report: HazardReport = {
      reportId: this._uuid(),
      riderId: params.riderId,
      groupId: params.groupId,
      hazardType: params.hazardType,
      lat: params.lat,
      lng: params.lng,
      timestampHlc: params.locationTimestampHlc,
      reportedAtHlc: this._hlc.now(),
    };
    await this._firestore.collection('hazard_reports').doc(report.reportId).set({
      report_id: report.reportId,
      rider_id: report.riderId,
      group_id: report.groupId,
      hazard_type: report.hazardType,
      lat: report.lat,
      lng: report.lng,
      timestamp_hlc: report.timestampHlc,
      reported_at_hlc: report.reportedAtHlc,
    });
    // TODO: trigger DBSCAN re-cluster over affected region
    // TODO: publish/update hazard_cluster to Firestore
  }

  /** Listen to hazard_cluster changes for a group (for UI overlay). */
  watchClusters(groupId: string) {
    return this._firestore
      .collection('hazards')
      .where('group_id', '==', groupId)
      .where('status', '==', 'active')
      .onSnapshot();
  }
}