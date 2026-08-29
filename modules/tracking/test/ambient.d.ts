declare module 'socket.io-client' {
  export type Socket = any;
}
declare module '@react-native-firebase/firestore';
declare module 'react-native-geolocation-service';
declare module 'react-native-background-geolocation';
declare module 'react-native-sensors';
declare module 'react-native-mmkv' {
  export class MMKV {
    constructor(config?: { id?: string; path?: string; encryptionKey?: string });
    getString(key: string): string | undefined;
    set(key: string, value: string | number | boolean): void;
    delete(key: string): void;
  }
}
