/**
 * Group List / Join / Create Ride screen (P0).
 * Owned by Person C. The app entry point after login.
 * Replaces group_list_screen.dart.
 */
import React, { useState, useEffect } from 'react';
import { View, TextInput, FlatList, TouchableOpacity, Text, StyleSheet, Pressable } from 'react-native';
import { firebaseAuth } from '../services/firebaseService';
import { useAppStore } from '../store/appStore';
import { WeRideColors } from '../theme/theme';
import { GroupService, Group } from '@routing/group/groupService';

export default function GroupListScreen({ navigation }: any) {
  const [joinCode, setJoinCode] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const uid = firebaseAuth.currentUser?.uid;
  const setGroupId = useAppStore((s) => s.setGroupId);
  const groupService = new GroupService();

  // Subscribe to groups on mount
  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    const unsubscribe = groupService.myGroups((fetchedGroups) => {
      setGroups(fetchedGroups);
      setLoading(false);
    });
    return unsubscribe;
  }, [uid]);

  const createGroup = async () => {
    try {
      const groupId = await groupService.createGroup();
      // Groups will update via onSnapshot subscription
    } catch (e) {
      console.error('Create group failed:', e);
      alert('Failed to create group');
    }
  };

  const joinGroup = async () => {
    const code = joinCode.trim();
    if (!code) {
      alert('Please enter a join code');
      return;
    }
    try {
      await groupService.joinGroup(code);
      setJoinCode('');
      // Groups will update via onSnapshot subscription
    } catch (e: any) {
      console.error('Join group failed:', e);
      alert(e.message || 'Failed to join group');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Rides</Text>
      </View>

      <View style={styles.joinRow}>
        <TextInput
          style={styles.input}
          placeholder="Join code"
          value={joinCode}
          onChangeText={setJoinCode}
          placeholderTextColor={WeRideColors.text.secondary}
        />
        <Pressable style={styles.joinButton} onPress={joinGroup}>
          <Text style={styles.joinButtonText}>Join</Text>
        </Pressable>
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
            <Text style={styles.groupName}>{item.name}</Text>
            <Text style={styles.groupMeta}>
              {item.member_ids.length} member{item.member_ids.length !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No rides yet</Text>
              <Text style={styles.emptySubtext}>Create one or join using a code</Text>
            </View>
          ) : null
        }
      />

      <Pressable style={styles.fab} onPress={createGroup}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: WeRideColors.surface },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '700', color: WeRideColors.text.primary },
  joinRow: { flexDirection: 'row', padding: 16, alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: WeRideColors.brand.border,
    borderRadius: 8,
    padding: 12,
    color: WeRideColors.text.primary,
    backgroundColor: '#fff',
  },
  joinButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: WeRideColors.accent,
    borderRadius: 8,
  },
  joinButtonText: { color: '#fff', fontWeight: '600' },
  groupItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: WeRideColors.brand.surface,
  },
  groupName: { fontSize: 16, fontWeight: '600', color: WeRideColors.text.primary },
  groupMeta: { fontSize: 13, color: WeRideColors.text.secondary, marginTop: 4 },
  empty: { paddingVertical: 48, alignItems: 'center' },
  emptyText: { fontSize: 16, color: WeRideColors.text.primary, fontWeight: '600' },
  emptySubtext: { fontSize: 13, color: WeRideColors.text.secondary, marginTop: 4 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: WeRideColors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '300' },
});