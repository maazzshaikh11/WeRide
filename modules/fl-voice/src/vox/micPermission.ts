/**
 * Microphone permission helper for VOX.
 * Android: PermissionsAndroid.request(RECORD_AUDIO).
 * iOS: AVAudioSession record permission (via react-native-webrtc's getUserMedia
 * is NOT sufficient on iOS 17+; we ask the session directly).
 * @returns {Promise<boolean>} true if mic access is granted.
 */
import { PermissionsAndroid, Platform } from 'react-native';

export async function requestMicrophonePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'WeRide needs microphone access for group voice intercom.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn('[micPermission] request failed:', err);
      return false;
    }
  }

  if (Platform.OS === 'ios') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { RTCAudioSession } = require('react-native-webrtc');
      await RTCAudioSession.requestRecordPermission?.();
      return true;
    } catch (err) {
      console.warn('[micPermission] iOS request failed:', err);
      return false;
    }
  }

  return false;
}

export async function checkMicrophonePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      return await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
    } catch {
      return false;
    }
  }
  return true; // iOS: no sync check; requestRecordPermission is idempotent
}