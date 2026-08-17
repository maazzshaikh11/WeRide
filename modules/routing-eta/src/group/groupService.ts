/**
 * Group List / Join / Create Ride service.
 * Firestore groups/ CRUD. Used by the GroupListScreen.
 * Ported from group_service.dart.
 */

import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { v4 as uuidv4 } from 'uuid';

export interface Group {
  id: string;
  name: string;
  created_by: string;
  member_ids: string[];
  created_at: any;
  active_ride_id: string | null;
}

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
    const FieldValue = (this._firestore as any).FieldValue;

    await this._firestore.collection('groups').doc(groupId).set({
      name: name ?? `Ride ${Date.now()}`,
      created_by: uid,
      member_ids: [uid],
      created_at: FieldValue.serverTimestamp(),
      active_ride_id: null,
    });
    return groupId;
  }

  async joinGroup(groupCode: string): Promise<void> {
    const uid = this._auth.currentUser!.uid;
    const FieldValue = (this._firestore as any).FieldValue;

    try {
      await this._firestore.collection('groups').doc(groupCode).update({
        member_ids: FieldValue.arrayUnion(uid),
      });
    } catch (e: any) {
      if (e.code === 'not-found') {
        throw new Error(`Group "${groupCode}" not found`);
      }
      throw e;
    }
  }

  /**
   * Subscribe to groups where current user is a member.
   * Returns a function to unsubscribe.
   */
  myGroups(onGroups: (groups: Group[]) => void): () => void {
    const uid = this._auth.currentUser!.uid;
    const unsubscribe = this._firestore
      .collection('groups')
      .where('member_ids', 'array-contains', uid)
      .onSnapshot(
        (snapshot: any) => {
          const groups: Group[] = snapshot.docs.map((doc: any) => ({
            id: doc.id,
            ...doc.data(),
          } as Group));
          onGroups(groups);
        },
        (error: any) => {
          console.error('Error fetching groups:', error);
          onGroups([]);
        }
      );
    return unsubscribe;
  }
}