const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const aliasMap = {
  '@app': path.resolve(projectRoot, 'src'),
  '@contracts': path.resolve(workspaceRoot, 'contracts'),
  '@tracking': path.resolve(workspaceRoot, 'modules/tracking/src'),
  '@hazard': path.resolve(workspaceRoot, 'modules/hazard-sos/src'),
  '@routing': path.resolve(workspaceRoot, 'modules/routing-eta/src'),
  '@flvoice': path.resolve(workspaceRoot, 'modules/fl-voice/src'),
};

const defaultConfig = getDefaultConfig(projectRoot);

defaultConfig.watchFolders = Object.values(aliasMap);

defaultConfig.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

defaultConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  for (const [alias, aliasPath] of Object.entries(aliasMap)) {
    if (moduleName === alias || moduleName.startsWith(alias + '/')) {
      const remaining = moduleName.slice(alias.length);
      const resolvedPath = path.join(aliasPath, remaining);
      return context.resolveRequest(context, resolvedPath, platform);
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

const config = {};

module.exports = mergeConfig(defaultConfig, config);