import 'react-native-get-random-values';
import { AppRegistry } from 'react-native';
import { name as appName } from './app.json';
import SecureRoot from './src/SecureRoot';
import { applyTextPolicy } from './src/theme/textPolicy';

applyTextPolicy();

// SecureRoot loads the storage key from the keystore, then mounts ./src/App (see src/SecureRoot.tsx).
AppRegistry.registerComponent(appName, () => SecureRoot);
