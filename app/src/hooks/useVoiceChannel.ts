/**
 * The crew voice channel as the Road screens see it: one shared VoxClient per ride, a status the UI can be honest
 * about, and push-to-talk (hold = unmute, release = mute).
 *
 * "live" means the VoxClient started: microphone granted and the /vox signalling room joined. (The module's peer audio
 * relay is still a TODO inside @flvoice, which is why the UI only ever claims what this status says.)
 * The client has no mute API of its own, so talking is the VAD broadcast (`setVoiceActive`) plus `setMuted` when a
 * future VoxClient offers it.
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import type { VoxClient } from '@flvoice/vox/voxClient';
import { checkMicrophonePermission, requestMicrophonePermission } from '@flvoice/vox/micPermission';
import { getVoxSocket } from '../services/socketService';
import { warn } from '../utils/log';

export type VoiceStatus = 'off' | 'connecting' | 'live' | 'denied';

interface VoiceState {
  status: VoiceStatus;
  talking: boolean;
}

export const useVoiceStore = create<VoiceState>(() => ({ status: 'off', talking: false }));

let client: VoxClient | null = null;
let clientKey: string | null = null;
let starting: Promise<void> | null = null;

/** Joins the crew channel. With `prompt` false it only connects when the microphone is already allowed. */
export function startVoice(groupId: string, uid: string, opts: { prompt?: boolean } = {}): Promise<void> {
  const key = `${groupId}:${uid}`;
  if (client && clientKey === key) return Promise.resolve();
  if (starting) return starting;
  starting = (async () => {
    try {
      const granted = opts.prompt ? await requestMicrophonePermission() : await checkMicrophonePermission();
      if (!granted) {
        useVoiceStore.setState({ status: opts.prompt ? 'denied' : 'off' });
        return;
      }
      useVoiceStore.setState({ status: 'connecting' });
      // loaded on demand: the WebRTC native module must not be pulled in by merely opening the screen
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { VoxClient: Vox } = require('@flvoice/vox/voxClient') as typeof import('@flvoice/vox/voxClient');
      const vox = new Vox({ groupId, riderId: uid, socket: getVoxSocket() });
      await vox.start();
      client = vox;
      clientKey = key;
      useVoiceStore.setState({ status: 'live' });
    } catch (e) {
      warn('[voice] could not join the crew channel:', e);
      useVoiceStore.setState({ status: 'off' });
    } finally {
      starting = null;
    }
  })();
  return starting;
}

export async function stopVoice(): Promise<void> {
  const c = client;
  client = null;
  clientKey = null;
  useVoiceStore.setState({ status: 'off', talking: false });
  try {
    await c?.stop();
  } catch (e) {
    warn('[voice] stop failed:', e);
  }
}

/** Hold = true, release = false. Returns false (and does nothing) when the channel is not live. */
export function setTalking(on: boolean): boolean {
  if (!client || useVoiceStore.getState().status !== 'live') return false;
  const c = client as VoxClient & { setMuted?: (m: boolean) => void };
  try {
    c.setMuted?.(!on);
    c.setVoiceActive(on);
  } catch (e) {
    warn('[voice] push-to-talk failed:', e);
    return false;
  }
  useVoiceStore.setState({ talking: on });
  return true;
}

/** Joins the channel for the ride while the screen is mounted (only if the mic is already allowed). */
export function useVoiceChannel(groupId: string | null, uid: string | null) {
  const status = useVoiceStore((s) => s.status);
  const talking = useVoiceStore((s) => s.talking);
  useEffect(() => {
    if (!groupId || !uid) return;
    startVoice(groupId, uid).catch(() => undefined);
  }, [groupId, uid]);
  return { status, talking };
}
