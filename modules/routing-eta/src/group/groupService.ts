/**
 * Group List / Join / Create Ride service.
 * Firestore groups/ CRUD. Used by the GroupListScreen.
 * Ported from group_service.dart.
 */

import firestore from '@react-native-firebase/auth';
import auth from '@react-native-firebase/auth';
import { v4 as uuidv4 } from 'uuid';

export class GroupService {
  private _firestore: ReturnType<typeof firestore>;
  private _auth: ReturnType<typeof auth>;
  private _uuid = uuidv4;

  constructor() {
    this._firestore = firestore();
    this._auth = auth();
  }

  async createGroup(name?: string): Promise<string> {
    const groupId = this._uuid();
    const uid = this._auth.currentUser!.uid;
    await this._firestore.collection('groups').doc(groupId).set({
      name: name ?? `Ride ${Date.now()}`,
      created_by: uid,
      member_ids: [uid],
      created_at: this._firestore.FieldValue.serverTimestamp(),
      active_ride_id: null,
    });
    return groupId;
  }

  async joinGroup(groupCode: string): Promise<void> {
    const uid = this._auth.currentUser!.uid;
    await this._firestore.collection('groups').doc(groupCode).update({
      member_ids: this._firestore.FieldValue.arrayUnion([uid]),
    });
  }

  myGroups() {
    const uid = this._auth.currentUser!.uid;
    return this._firestore.collection('groups').where('member_ids', 'array-contains', uid).onSnapshot();
  }
}