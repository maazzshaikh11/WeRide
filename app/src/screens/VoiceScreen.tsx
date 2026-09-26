/**
 * VoiceScreen — group voice / intercom tab (spec §3.5, §4.4).
 * Replaces the VoxOverlay FAB. Integrates Person D's VoxClient (NOT modified):
 * start()/stop()/setVoiceActive() called from here.
 * Data: ridersStore for participants, getVoxSocket() for the /vox connection.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, useWindowDimensions, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WeRideColors, WeRideFonts, riderColor } from '../theme/theme';
import ScreenHeader from '../components/ScreenHeader';
import LivePill from '../components/LivePill';
import VoiceAvatar from '../components/VoiceAvatar';
import VoiceToolbar from '../components/VoiceToolbar';
import VoxZone, { VoxState } from '../components/VoxZone';
import { useRidersStore } from '../store/ridersStore';
import { useAppStore } from '../store/appStore';
import { useToastStore } from '../store/toastStore';
import { getVoxSocket } from '../services/socketService';
import { VoxClient } from '@flvoice/vox/voxClient';
import { requestMicrophonePermission } from '@flvoice/vox/micPermission';

type VoiceStatus = 'connected' | 'connecting' | 'disconnected';

export default function VoiceScreen() {
  const groupId = useAppStore((s) => s.groupId);
  const userId = useAppStore((s) => s.userId);
  const riders = useRidersStore((s) => s.riders);
  const push = useToastStore((s) => s.push);

  const [status, setStatus] = useState<VoiceStatus>('connecting');
  const [muted, setMuted] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const voxRef = useRef<VoxClient | null>(null);

  // VoxClient lifecycle — only when identity is available (Person D's API, unmodified)
  useEffect(() => {
    if (!groupId || !userId) return;

    let vox: VoxClient | null = null;
    let cancelled = false;

    const init = async () => {
      try {
        // Request mic permission BEFORE VoxClient.start() (getUserMedia).
        const micGranted = await requestMicrophonePermission();
        if (!micGranted) {
          console.warn('[VoiceScreen] Microphone permission denied');
          setMicDenied(true);
          setStatus('disconnected');
          return;
        }
        if (cancelled) return;
        vox = new VoxClient({ groupId, riderId: userId, socket: getVoxSocket() });
        voxRef.current = vox;
        vox.start().then(() => setStatus('connected')).catch((e: unknown) => {
          console.warn('[VoiceScreen] VoxClient.start failed:', e);
          setStatus('disconnected');
        });
      } catch (e) {
        console.warn('[VoiceScreen] VoxClient init failed:', e);
        setStatus('disconnected');
      }
    };
    init();

    // voice_active broadcast from other riders → ring pulse on their avatar
    const socket = getVoxSocket();
    const onVoiceActive = (payload: { rider_id?: string; active?: boolean } | boolean) => {
      const riderId = typeof payload === 'object' && payload !== null && 'rider_id' in payload
        ? String(payload.rider_id)
        : userId!;
      const active = typeof payload === 'boolean' ? payload : (payload as { active?: boolean })?.active !== false;
      setSpeakingId(active ? riderId : null);
    };
    socket.on('voice_active', onVoiceActive);

    return () => {
      cancelled = true;
      socket.off('voice_active', onVoiceActive);
      vox?.stop().catch((e: unknown) => {
        console.warn('[VoiceScreen] VoxClient.stop failed:', e);
      });
      voxRef.current = null;
      setStatus('disconnected');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, userId]);

  const participants = useMemo(() => Array.from(riders.keys()), [riders]);

  // Current user is always a participant; merge if absent from riders map
  const allNames = useMemo(() => {
    const list = userId ? [userId, ...participants.filter((p) => p !== userId)] : participants;
    return list.slice(0, 8); // MAX_PEERS cap per Person D
  }, [participants, userId]);

  const voxState: VoxState =
    status === 'disconnected' ? 'disconnected' :
    status === 'connecting' ? 'connecting' :
    muted ? 'muted' :
    speakingId === userId ? 'speaking' : 'idle';

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    if (!next) {
      // Unmuting: broadcast manual voice active so group hears intent
      voxRef.current?.setVoiceActive(true);
    }
  };

  const leave = () => {
    voxRef.current?.stop().catch(() => undefined);
    setStatus('disconnected');
    push('You left the voice channel', 'error');
  };

  // Demo grid is always 3 columns (repeat(3, 1fr)) — no narrow breakpoint.
  const columns = 3;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <ScreenHeader
          eyebrow="03 — Intercom"
          title="Group Voice"
          right={
            status === 'connected' ? (
              <LivePill variant="green" label={`${allNames.length} IN CALL`} />
            ) : status === 'connecting' ? (
              <LivePill variant="gold" label="CONNECTING" />
            ) : (
              <LivePill variant="grey" label="OFFLINE" />
            )
          }
        />

        <ScrollView contentContainerStyle={styles.gridContent}>
          {micDenied && (
            <View style={styles.micDeniedBox}>
              <Text style={styles.micDeniedTitle}>Microphone access denied</Text>
              <Text style={styles.micDeniedText}>
                Voice intercom needs the microphone. Enable it in Settings → Apps → WeRide → Permissions, then return to this screen.
              </Text>
            </View>
          )}
          <View style={styles.grid}>
            {allNames.map((riderId, i) => (
              <View key={riderId} style={[styles.cell, { width: `${100 / columns}%` }]}>
                <VoiceAvatar
                  initials={riderId.slice(0, 2).toUpperCase()}
                  color={riderColor(i)}
                  name={`Rider ${riderId.slice(-4)}`}
                  isYou={riderId === userId}
                  speaking={speakingId === riderId}
                  isLeader={i === 0}
                />
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.spacer} />

        <View style={styles.bottom}>
          <VoiceToolbar
            muted={muted}
            disabled={status === 'disconnected'}
            onMuteToggle={toggleMute}
            onLeave={leave}
          />
          <VoxZone state={voxState} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WeRideColors.dark },
  container: { flex: 1 },
  gridContent: { paddingHorizontal: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  cell: { alignItems: 'center', marginBottom: 10 },
  spacer: { flex: 1 },
  bottom: { alignItems: 'center', gap: 16, paddingBottom: 12, paddingHorizontal: 18 },
  micDeniedBox: {
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.error,
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
  },
  micDeniedTitle: {
    fontFamily: WeRideFonts.body,
    fontSize: 13,
    fontWeight: '700',
    color: WeRideColors.error,
    marginBottom: 6,
  },
  micDeniedText: {
    fontFamily: WeRideFonts.body,
    fontSize: 12,
    color: WeRideColors.textSub,
    lineHeight: 16,
  },
});