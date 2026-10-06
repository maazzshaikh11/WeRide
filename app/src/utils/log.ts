/** One place for the console, so call sites stay lint-clean. Failures that are handled (offline, retry) are warnings, not errors. */
/* eslint-disable no-console */
export const warn = (...args: unknown[]): void => console.warn(...args);
export const logError = (...args: unknown[]): void => console.error(...args);
