/**
 * FamilyScreen — family tracking tab (spec §3.6).
 * Toggle card, copy-link row, member list with status badges.
 * Data: GroupService members (Person C) + appStore.familySharingEnabled.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import { WeRideColors, WeRideFonts } from '../theme/theme';
import ScreenHeader from '../components/ScreenHeader';
import LivePill from '../components/LivePill';
import FamilyToggle from '../components/FamilyToggle';
import FamilyMemberCard from '../components/FamilyMemberCard';
import { useAppStore } from '../store/appStore';
import { useToastStore } from '../store/toastStore';
import { GroupService, Group } from '@routing/group/groupService';

export default function FamilyScreen() {
  const groupId = useAppStore((s) => s.groupId);
  const familySharingEnabled = useAppStore((s) => s.familySharingEnabled);
  const setFamilySharingEnabled = useAppStore((s) => s.setFamilySharingEnabled);
  const push = useToastStore((s) => s.push);
  const [copied, setCopied] = useState(false);
  const [group, setGroup] = useState<Group | null>(null);

  // Fetch group metadata for member list (Person C's GroupService, unmodified)
  useEffect(() => {
    if (!groupId) return;
    const groupService = new GroupService();
    let mounted = true;
    const unsubscribe = groupService.myGroups((groups) => {
      if (!mounted) return;
      const match = groups.find((g) => g.id === groupId) ?? groups[0] ?? null;
      setGroup(match);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [groupId]);

  const members = useMemo(() => (group?.member_ids ?? []).slice(0, 12), [group]);
  const trackingLink = `https://weride.app/track/${groupId ?? 'unknown'}`;

  const copyLink = () => {
    try {
      Clipboard.setString(trackingLink);
    } catch {
      // Clipboard unavailable in some environments; still acknowledge per spec UX.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          eyebrow="05 — Peace of mind"
          title="Family Tracking"
          right={
            familySharingEnabled ? (
              <LivePill variant="green" label="SHARING" />
            ) : (
              <LivePill variant="grey" label="PAUSED" />
            )
          }
        />

        <FamilyToggle
          enabled={familySharingEnabled}
          onToggle={(next) => {
            setFamilySharingEnabled(next);
            push(next ? '👪 Family sharing turned on' : '🔒 Family sharing turned off', next ? 'success' : 'error');
          }}
        />

        <View style={styles.linkRow}>
          <Text style={styles.linkIcon}>🔗</Text>
          <View style={styles.linkTextWrap}>
            <Text style={styles.linkTitle}>Live tracking link</Text>
            <Text style={styles.linkSub}>Works even if they don't have WeRide</Text>
          </View>
          <Pressable
            style={styles.copyBtn}
            onPress={copyLink}
            accessibilityLabel="Copy live tracking link"
            accessibilityRole="button"
          >
            <Text style={styles.copyText}>{copied ? 'Copied ✓' : 'Copy link'}</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>WATCHING THIS RIDE</Text>

        {members.map((memberId, i) => (
          <FamilyMemberCard
            key={memberId}
            name={i === 0 ? 'Group Creator' : `Rider ${memberId.slice(-4)}`}
            meta="Last checked · just now"
            status="safe"
          />
        ))}
        {members.length === 0 && <Text style={styles.empty}>No members yet</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WeRideColors.dark },
  content: { paddingHorizontal: 18, paddingBottom: 20 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: 14,
    padding: 11,
    marginBottom: 18,
  },
  linkIcon: { fontSize: 16 },
  linkTextWrap: { flex: 1 },
  linkTitle: { fontFamily: WeRideFonts.body, fontSize: 12, fontWeight: '700', color: WeRideColors.white },
  linkSub: { fontFamily: WeRideFonts.body, fontSize: 9.5, color: WeRideColors.textSub, marginTop: 1 },
  copyBtn: {
    backgroundColor: '#FF5C0022',
    borderWidth: 1,
    borderColor: '#FF5C0044',
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  copyText: { fontFamily: WeRideFonts.body, fontSize: 10.5, fontWeight: '700', color: WeRideColors.primary },
  sectionLabel: {
    fontFamily: WeRideFonts.mono,
    fontSize: 9.5,
    color: WeRideColors.textSub,
    letterSpacing: 1,
    marginBottom: 10,
  },
  empty: { fontFamily: WeRideFonts.body, fontSize: 13, color: WeRideColors.textSub, textAlign: 'center', marginTop: 16 },
});