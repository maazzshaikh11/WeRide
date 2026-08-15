// Cloud Function: SOS FCM push trigger.
// On sos_events/{sosId} create → send FCM push to all group members.
// Deploy: firebase deploy --only functions
//
// TODO: implement — Person B coordinates with infra.

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.onSosCreate = functions.firestore
  .document('sos_events/{sosId}')
  .onCreate(async (snap, context) => {
    const sos = snap.data();
    const groupId = sos.group_id;

    // Fetch group members
    const groupDoc = await admin.firestore().doc(`groups/${groupId}`).get();
    const memberIds = groupDoc.data().member_ids || [];

    // Fetch FCM tokens for each member
    const tokens = [];
    for (const uid of memberIds) {
      if (uid === sos.rider_id) continue; // don't notify the sender
      const userDoc = await admin.firestore().doc(`users/${uid}`).get();
      const token = userDoc.data()?.fcm_token;
      if (token) tokens.push(token);
    }

    if (tokens.length === 0) return;

    // Send FCM multicast
    const message = {
      notification: {
        title: 'SOS Alert',
        body: `A rider in your group triggered SOS: ${sos.lat}, ${sos.lng}`,
      },
      data: { group_id: groupId, sos_id: context.params.sosId },
      tokens: tokens,
    };

    await admin.messaging().sendMulticast(message);
  });