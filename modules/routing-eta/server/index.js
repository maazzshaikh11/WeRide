import { createRealtimeServer, SIGNAL_LABELS } from './app.js';
import { loadSecurityConfig } from './security/config.js';
import { bootstrapAuth } from './security/auth.js';

// Throws on an unsafe combination (ALLOW_INSECURE_DEV_AUTH=1 under NODE_ENV=production).
const config = loadSecurityConfig(process.env);
const { app, server, io, ctx } = createRealtimeServer(config);

/**
 * Wire authentication and listen. Refuses to start (throws) when no ID-token
 * verifier is configured: the server is never open by default.
 */
export async function startServer(port = process.env.PORT || 3000) {
  await bootstrapAuth(config, process.env);
  await new Promise((resolve) => server.listen(port, resolve));
  console.log(`WeRide server on :${port}`);
  return server;
}

// Exported for tests (node --test). The listener only starts outside tests.
if (process.env.NODE_ENV !== 'test') {
  startServer().catch((e) => {
    console.error(`FATAL: ${e.message}`);
    process.exit(1);
  });
}

export { app, server, io, ctx, SIGNAL_LABELS };
