import { PermissionsAndroid, Platform } from 'react-native';
// @ts-ignore
import Geolocation from 'react-native-geolocation-service';

/**
 * Requests location permission for tracking.
 * - Android: Requests ACCESS_FINE_LOCATION.
 * - iOS: Requests 'always' authorization via geolocation service.
 *
 * @returns {Promise<boolean>} true if granted, false if denied.
 */
export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'App needs access to your location to track your ride.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn(err);
      return false;
    }
  } else if (Platform.OS === 'ios') {
    try {
      const authResult = await Geolocation.requestAuthorization('always');
      return authResult === 'granted';
    } catch (err) {
      console.warn(err);
      return false;
    }
  }
  return false;
}
