/**
 * VoiceScreen — group voice / intercom tab (spec §3.5, §4.4).
 * Replaces the VoxOverlay FAB. Integrates Person D's VoxClient (NOT modified):
 * start()/stop()/setVoiceActive() called from here.
 * Data: ridersStore for participants, getVoxSocket() for the /vox connection.
 *
 * Honesty notes (audit):
 *  - Participants are the riders publishing a location in this ride (+ "You").
 *    The screen cannot know who has actually joined the voice channel, so the
 *    list is labelled "Riders in this ride", never "in call".
 *  - VoxClient only joins the signalling room today (peer connections / audio
 *    relay are TODO in modules/fl-voice), so connected states say audio is not
 *    live yet. It also has no mute API: "Mute" only gates the voice_active
 *    broadcast. Remote `voice_active` payloads carry the sender's socket id
 *    (server: vox_signaling.js), not a rider id, so remote speaking rings only
 *    light up if an id matches a listed rider.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, Text, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WeRideColors, WeRideRadius, WeRideSpacing, riderColor } from '../theme/theme';
import { type } from '../theme/typography';
import ScreenHeader from '../components/ScreenHeader';
import LivePill from '../components/LivePill';
import VoiceAvatar from '../components/VoiceAvatar';
import VoiceToolbar from '../components/VoiceToolbar';
import VoxZone, { VoxState } from '../components/VoxZone';
import { Button, FadeIn } from '../ui';
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
    const onVoiceActive = (payload: { rider_id?: string; riderId?: string; active?: boolean } | boolean) => {
      const sender = typeof payload === 'object' && payload !== null ? (payload.rider_id ?? payload.riderId) : undefined;
      const riderId = sender != null ? String(sender) : userId!;
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

  // Without a ride + identity there is nothing to connect to.
  const ready = groupId != null && userId != null;
  const effectiveStatus: VoiceStatus = ready ? status : 'disconnected';

  const voxState: VoxState =
    effectiveStatus === 'disconnected' ? 'disconnected' :
    effectiveStatus === 'connecting' ? 'connecting' :
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
    push('You left the voice channel', 'warn');
  };

  const openSettings = () => {
    Linking.openSettings().catch(() => {
      push('Could not open Settings — enable the microphone for WeRide manually', 'error');
    });
  };

  const voxDetail = micDenied
    ? 'Microphone access is off, so you cannot join the voice channel.'
    : !ready
      ? 'Open a ride to join its voice channel.'
      : undefined;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.gutter}>
          <ScreenHeader
            title="Group Voice"
            right={
              effectiveStatus === 'connected' ? (
                <LivePill variant="green" label="CONNECTED" />
              ) : effectiveStatus === 'connecting' ? (
                <LivePill variant="gold" label="CONNECTING" />
              ) : (
                <LivePill variant="grey" label="OFFLINE" />
              )
            }
          />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.gridContent}>
          {micDenied && (
            <FadeIn>
              <View style={styles.micDeniedBox} accessibilityRole="alert">
                <Text style={[type.heading, { color: WeRideColors.red }]}>Microphone access denied</Text>
                <Text style={[type.body, styles.micDeniedText]}>
                  Group voice needs the microphone. Allow it in Settings, then come back to this tab.
                </Text>
                <Button
                  label="Open settings"
                  variant="secondary"
                  size="sm"
                  onPress={openSettings}
                  accessibilityLabel="Open settings"
                  style={styles.settingsBtn}
                />
              </View>
            </FadeIn>
          )}

          <Text style={[type.label, styles.sectionLabel]}>
            {`RIDERS IN THIS RIDE · ${allNames.length}`}
          </Text>
          {allNames.length === 0 ? (
            <FadeIn>
              <View style={styles.emptyBox}>
                <Text style={type.heading}>No riders yet</Text>
                <Text style={[type.body, styles.micDeniedText]}>Riders appear here once they join the ride.</Text>
              </View>
            </FadeIn>
          ) : (
            <View style={styles.grid}>
              {allNames.map((riderId, i) => (
                <FadeIn key={riderId} index={i} style={styles.cell}>
                  {/* No display names exist yet: initials and label come from the rider id. */}
                  <VoiceAvatar
                    initials={riderId.slice(0, 2).toUpperCase()}
                    color={riderColor(i)}
                    name={`Rider ${riderId.slice(-4)}`}
                    isYou={riderId === userId}
                    speaking={speakingId === riderId}
                  />
                </FadeIn>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={styles.bottom}>
          <VoxZone state={voxState} detail={voxDetail} />
          <VoiceToolbar
            muted={muted}
            disabled={effectiveStatus === 'disconnected'}
            onMuteToggle={toggleMute}
            onLeave={leave}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WeRideColors.dark },
  container: { flex: 1 },
  gutter: { paddingHorizontal: WeRideSpacing.lg },
  scroll: { flex: 1 },
  gridContent: { paddingHorizontal: WeRideSpacing.lg, paddingBottom: WeRideSpacing.lg },
  sectionLabel: { marginBottom: WeRideSpacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '33.3333%', alignItems: 'center', paddingVertical: WeRideSpacing.sm },
  bottom: {
    gap: WeRideSpacing.lg,
    margin: WeRideSpacing.lg,
    padding: WeRideSpacing.lg,
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: WeRideRadius.xl,
  },
  micDeniedBox: {
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.red,
    borderRadius: WeRideRadius.xl,
    padding: WeRideSpacing.lg,
    gap: WeRideSpacing.xs,
    marginBottom: WeRideSpacing.lg,
  },
  micDeniedText: { color: WeRideColors.textSub },
  settingsBtn: { marginTop: WeRideSpacing.md },
  emptyBox: {
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: WeRideRadius.xl,
    padding: WeRideSpacing.lg,
    gap: WeRideSpacing.xs,
  },
});
