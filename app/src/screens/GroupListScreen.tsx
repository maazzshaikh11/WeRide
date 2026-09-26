/**
 * Group List / Join / Create Ride screen (P0) — dark restyle (spec §3.2).
 * Owned by Person C. Auth flow preserved: tap group → setGroupId → MainApp.
 */
import React, { useState, useEffect } from 'react';
import { View, TextInput, FlatList, TouchableOpacity, Text, StyleSheet, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { firebaseAuth } from '../services/firebaseService';
import { useAppStore } from '../store/appStore';
import { WeRideColors, WeRideFonts } from '../theme/theme';
import { GroupService, Group } from '@routing/group/groupService';
import CreateRideModal from '../components/CreateRideModal';

export default function GroupListScreen({ navigation }: any) {
  const [joinCode, setJoinCode] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
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

  const joinGroup = async () => {
    const code = joinCode.trim();
    if (!code) {
      Alert.alert('Error', 'Please enter a join code');
      return;
    }
    try {
      await groupService.joinGroup(code);
      setJoinCode('');
    } catch (e: any) {
      console.error('Join group failed:', e);
      Alert.alert('Error', e.message || 'Failed to join group');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>My Rides</Text>
        </View>

        <View style={styles.joinRow}>
          <TextInput
            style={styles.input}
            placeholder="Join code"
            placeholderTextColor={WeRideColors.textSub}
            value={joinCode}
            onChangeText={setJoinCode}
            accessibilityLabel="Join code input"
          />
          <Pressable
            style={({ pressed }) => [styles.joinButton, pressed && styles.joinButtonPressed]}
            onPress={joinGroup}
            accessibilityLabel="Join group"
            accessibilityRole="button"
          >
            <Text style={styles.joinButtonText}>Join</Text>
          </Pressable>
        </View>

        {loading ? <ActivityIndicator color={WeRideColors.primary} style={styles.loader} /> : null}

        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.groupItem}
              onPress={() => {
                setGroupId(item.id);
                navigation.navigate('MainApp', { groupId: item.id });
              }}
              accessibilityLabel={`Open ride ${item.name}`}
              accessibilityRole="button"
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

        <Pressable
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          onPress={() => setCreateModalOpen(true)}
          accessibilityLabel="Create new ride"
          accessibilityRole="button"
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>

        <CreateRideModal
          visible={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onCreated={(groupId) => {
            setCreateModalOpen(false);
            navigation.navigate('MainApp', { groupId });
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WeRideColors.dark },
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  title: { fontFamily: WeRideFonts.heading, fontSize: 28, color: WeRideColors.text },
  joinRow: { flexDirection: 'row', padding: 16, alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: WeRideColors.text,
    backgroundColor: WeRideColors.dark3,
    fontFamily: WeRideFonts.body,
    fontSize: 14,
  },
  joinButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: 8,
  },
  joinButtonPressed: { backgroundColor: WeRideColors.primaryDim },
  joinButtonText: { fontFamily: WeRideFonts.body, fontSize: 12, fontWeight: '700', color: WeRideColors.primary },
  loader: { marginTop: 8 },
  listContent: { paddingHorizontal: 16 },
  groupItem: {
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  groupName: { fontFamily: WeRideFonts.body, fontSize: 13, fontWeight: '700', color: WeRideColors.text },
  groupMeta: { fontFamily: WeRideFonts.body, fontSize: 10, color: WeRideColors.textSub, marginTop: 2 },
  empty: { paddingVertical: 48, alignItems: 'center' },
  emptyText: { fontFamily: WeRideFonts.body, fontSize: 16, fontWeight: '600', color: WeRideColors.text },
  emptySubtext: { fontFamily: WeRideFonts.body, fontSize: 13, color: WeRideColors.textSub, marginTop: 4 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: WeRideColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  fabPressed: { opacity: 0.85, transform: [{ scale: 0.92 }] },
  fabText: { color: WeRideColors.onPrimary, fontSize: 28, fontWeight: '300' },
});