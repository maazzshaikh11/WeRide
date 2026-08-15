/**
 * WebRTC VOX client.
 * Mesh topology: direct peer connection with each rider in the group (cap 8).
 * Signaling via Socket.io /vox namespace. Audio only. VAD-driven voice_active broadcast.
 * Ported from vox_client.dart.
 *
 * TODO: implement full peer connection management, ICE exchange, audio stream.
 */

import { Socket } from 'socket.io-client';
import {
  mediaDevices,
  RTCPeerConnection,
  MediaStream,
} from 'react-native-webrtc';

export const MAX_PEERS = 8; // group cap per spec §2

export interface VoxClientParams {
  groupId: string;
  riderId: string;
  socket: Socket;
}

export class VoxClient {
  readonly groupId: string;
  readonly riderId: string;
  readonly socket: Socket;

  private _peers = new Map<string, RTCPeerConnection>();
  private _localStream?: MediaStream;
  private _voiceActive = false;

  constructor(params: VoxClientParams) {
    this.groupId = params.groupId;
    this.riderId = params.riderId;
    this.socket = params.socket;
  }

  async start(): Promise<void> {
    // 1. Get local audio stream
    this._localStream = await mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      } as any,
      video: false,
    });

    // 2. Join the /vox room
    this.socket.emit('join', this.groupId);

    // 3. Listen for signaling events
    this.socket.on('sdp', this._onRemoteSdp);
    this.socket.on('ice', this._onRemoteIce);
    this.socket.on('voice_active', this._onVoiceActive);
  }

  private async _createPeer(peerId: string): Promise<RTCPeerConnection> {
    if (this._peers.size >= MAX_PEERS) {
      throw new Error(`Group full for voice (max ${MAX_PEERS})`);
    }
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    this._localStream?.getTracks().forEach((t) => {
      if (this._localStream) pc.addTrack(t, this._localStream);
    });
    this._peers.set(peerId, pc);
    return pc;
  }

  private _onRemoteSdp = (payload: any): void => {
    // TODO: setRemoteDescription, createAnswer, send back
  };

  private _onRemoteIce = (payload: any): void => {
    // TODO: addIceCandidate
  };

  private _onVoiceActive = (payload: any): void => {
    // TODO: update UI — avatar ring highlight for payload.riderId
  };

  /** Broadcast voice_active to the group (VAD-detected). */
  setVoiceActive(active: boolean): void {
    if (this._voiceActive === active) return;
    this._voiceActive = active;
    this.socket.emit('voice_active', active);
  }

  async stop(): Promise<void> {
    for (const pc of this._peers.values()) {
      pc.close();
    }
    this._peers.clear();
    this._localStream?.release();
  }
}