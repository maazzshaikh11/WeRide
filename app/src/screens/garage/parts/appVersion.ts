/** The app version shown in the Me footer, read once from package.json. */
// eslint-disable-next-line @typescript-eslint/no-require-imports -- JSON constant, no import-attribute support needed
export const APP_VERSION: string = String(require('../../../../package.json').version ?? '');
