/**
 * Group List / Join / Create Ride screen (P0).
 * Owned by Person C. The app entry point after login.
 * Replaces group_list_screen.dart.
 */
import React, { useState } from 'react';
import { View, TextInput, IconButton, FlatList, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import { firebaseAuth, firebaseFirestore } from '../services/firebaseService';
import { useAppStore } from '../store/appStore';
import { WeRideColors } from '../theme/theme';

export default function GroupListScreen({ navigation }: any) {
  const [joinCode, setJoinCode] = useState('');
  const uid = firebaseAuth.currentUser?.uid;
  const setGroupId = useAppStore((s) => s.setGroupId);

  const createGroup = async () => {
    const groupId = uuidv4();
    await firebaseFirestore().collection('groups').doc(groupId).set({
      name: `Ride ${Date.now()}`,
      created_by: uid,
      member_ids: [uid],
      created_at: firebaseFirestore.FieldValue.serverTimestamp(),
      active_ride_id: null,
    });
  };

  const joinGroup = async () => {
    const code = joinCode.trim();
    await firebaseFirestore().collection('groups').doc(code).update({
      member_ids: firebaseFirestore.FieldValue.arrayUnion([uid]),
    });
    setJoinCode('');
  };

  // TODO: subscribe to groups where member_ids contains uid via onSnapshot
  const groups: { id: string; name: string }[] = [];

  return (
    <View style={styles.container}>
      <View style={styles.joinRow}>
        <TextInput style={styles.input} placeholder="Join code" value={joinCode} onChangeText={setJoinCode} />
        <IconButton icon="login" onPress={joinGroup} />
      </View>
      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.groupItem}
            onPress={() => {
              setGroupId(item.id);
              navigation.navigate('Map', { groupId: item.id });
            }}
          >
            <Text>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity style={styles.fab} onPress={createGroup}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: WeRideColors.background },
  joinRow: { flexDirection: 'row', padding: 16, alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginRight: 8 },
  groupItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: WeRideColors.accent, justifyContent: 'center', alignItems: 'center' },
  fabText: { color: '#fff', fontSize: 24 },
});