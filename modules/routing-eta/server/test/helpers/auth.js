// Test doubles for the injectable auth seams (no Firebase, no network).
import { setTokenVerifier, setMembershipProvider, resetAuth } from '../../security/auth.js';
import { io as clientIo } from 'socket.io-client';

export const tokenFor = (uid) => `fake-token:${uid}`;

/** Verifier that accepts "fake-token:<uid>" and rejects everything else. */
export function fakeVerifier(extra = {}) {
  return async (token) => {
    const m = /^fake-token:(.+)$/.exec(token);
    if (!m) throw new Error('bad token');
    return { uid: m[1], ...extra };
  };
}

/**
 * Install the fakes. `groups` maps group id -> member uids and is read live,
 * so a test can mutate it (e.g. remove a member).
 * @returns {{groups:object, fetches:string[]}}
 */
export function installFakeAuth(groups, { verifierExtra, membershipOpts } = {}) {
  const fetches = [];
  setTokenVerifier(fakeVerifier(verifierExtra));
  setMembershipProvider(async (groupId) => {
    fetches.push(groupId);
    return groups[groupId] || [];
  }, membershipOpts);
  return { groups, fetches };
}

export { resetAuth };

/** Connect an authenticated socket (resolves once connected). */
export function connectAs(port, uid, { ns = '', token } = {}) {
  const s = clientIo(`http://127.0.0.1:${port}${ns}`, {
    transports: ['websocket'],
    reconnection: false,
    auth: { token: token ?? tokenFor(uid) },
  });
  return new Promise((resolve, reject) => {
    s.once('connect', () => resolve(s));
    s.once('connect_error', (e) => { s.close(); reject(e); });
  });
}

/** Attempt a connection that is expected to be refused; resolves with the error. */
export function connectExpectRefusal(port, auth, ns = '') {
  const s = clientIo(`http://127.0.0.1:${port}${ns}`, { transports: ['websocket'], reconnection: false, auth });
  return new Promise((resolve, reject) => {
    s.once('connect', () => { s.close(); reject(new Error('connection was ACCEPTED')); });
    s.once('connect_error', (e) => { s.close(); resolve(e); });
    // A server that drops an oversize handshake outright never answers: still a refusal.
    setTimeout(() => { if (!s.connected) { s.close(); resolve(new Error('no connection')); } }, 2500);
  });
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** emit with ack, resolves the ack payload */
export const emitAck = (s, ev, arg) => new Promise((r) => s.emit(ev, arg, r));
