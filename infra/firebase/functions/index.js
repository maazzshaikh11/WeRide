// Cloud Function: SOS FCM push trigger.
// On sos_events/{sosId} create → send FCM push to all group members.
// Deploy: firebase deploy --only functions
//

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
    const memberIds = groupDoc.data()?.member_ids || [];
    // Don't trust the event's claims: the sender must belong to the group they're alerting.
    if (!groupDoc.exists || !memberIds.includes(sos.rider_id)) return;

    // Fetch FCM tokens for each member
    const tokens = [];
    for (const uid of memberIds) {
      if (uid === sos.rider_id) continue; // don't notify the sender
      const userDoc = await admin.firestore().doc(`users/${uid}/private/settings`).get();
      const token = userDoc.data()?.fcm_token;
      if (token) tokens.push(token);
    }

    const uniqueTokens = [...new Set(tokens)];
    if (uniqueTokens.length === 0) return;

    // Send FCM multicast
    const message = {
      notification: {
        title: 'SOS Alert',
        body: `A rider in your group triggered SOS: ${sos.lat}, ${sos.lng}`,
      },
      data: { group_id: groupId, sos_id: context.params.sosId },
      tokens: uniqueTokens,
    };

    // sendEachForMulticast replaces sendMulticast (removed in firebase-admin 13).
    await admin.messaging().sendEachForMulticast(message);
  });
