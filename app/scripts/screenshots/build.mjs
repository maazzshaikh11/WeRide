import { build } from 'esbuild';
import path from 'node:path';
const APP = path.resolve('../..');
const S = (f) => path.resolve('stubs', f);
const rules = [
  [/^react-native-geolocation-service$/, 'geolocation.js'],
  [/^@react-native-firebase\/firestore$/, 'firestore.js'],
  [/^@react-native-firebase\/auth$/, 'auth.js'],
  [/^@react-native-firebase\/messaging$/, 'messaging.js'],
  [/^(@react-native-firebase\/.*|@react-native-clipboard\/clipboard|@react-native-community\/netinfo|react-native-webrtc|react-native-background-geolocation|react-native-get-random-values|@react-native-ml-kit\/.*|react-native-screens|react-native-gesture-handler)$/, 'generic.js'],
  [/^(@react-navigation\/.*|socket\.io-client|react-native-mmkv|react-native-sensors)$/, 'named.js'],
  [/^@rnmapbox\/maps$/, 'mapbox.js'],
  [/^react-native-svg$/, 'svg.js'],
  [/^react-native-safe-area-context$/, 'safearea.js'],
  [/^@env$/, 'env.js'],
  [/services\/socketService$/, 'socket.js'],
  [/services\/firebaseService$/, 'firebaseService.js'],
  [/services\/localStorage$/, 'generic.js'],
  [/^@routing\/group\/groupService$/, 'groupService.js'],
  [/^@hazard\/(services\/(hazardService|sosService)|crdt\/.*)$/, 'hazard.js'],
  [/^@tracking\//, 'tracking.js'],
  [/^@flvoice\//, 'vox.js'],
];
const stubPlugin = { name: 'stubs', setup(b) { b.onResolve({ filter: /.*/ }, (a) => { for (const [re, f] of rules) if (re.test(a.path)) return { path: S(f) }; return null; }); } };
await build({
  entryPoints: [process.argv[2] || 'scenes.tsx'], bundle: true, outfile: 'scenes.js', format: 'iife', jsx: 'automatic',
  loader: { '.ts': 'ts', '.tsx': 'tsx', '.png': 'dataurl', '.jpeg': 'dataurl', '.jpg': 'dataurl', '.js': 'jsx' },
  plugins: [stubPlugin],
  alias: {
    react: path.resolve('node_modules/react'), 'react-dom': path.resolve('node_modules/react-dom'),
    'react/jsx-runtime': path.resolve('node_modules/react/jsx-runtime.js'), 'react-native': path.resolve('stubs/rn.js'),
    '@app': path.join(APP, 'src'), '@routing': path.join(APP, '../modules/routing-eta/src'),
    '@hazard': path.join(APP, '../modules/hazard-sos/src'), '@tracking': path.join(APP, '../modules/tracking/src'),
    '@flvoice': path.join(APP, '../modules/fl-voice/src'),
  },
  define: { global: 'globalThis', 'process.env.NODE_ENV': '"development"', __DEV__: 'true' },
  logLevel: 'error',
});
console.log('built');
