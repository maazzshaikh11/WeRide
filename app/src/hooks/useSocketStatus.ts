/**
 * Socket.io connection status hook (spec §8: live pill + network banner).
 * Wraps the shared location socket's connect/disconnect/reconnect events.
 */
import { useEffect, useState } from 'react';
import { getLocationSocket } from '../services/socketService';

export type SocketStatus = 'connected' | 'reconnecting' | 'offline';

export function useSocketStatus(): SocketStatus {
  const [status, setStatus] = useState<SocketStatus>(() => {
    const socket = getLocationSocket();
    return socket.connected ? 'connected' : 'offline';
  });

  useEffect(() => {
    const socket = getLocationSocket();
    setStatus(socket.connected ? 'connected' : 'reconnecting');

    const onConnect = () => setStatus('connected');
    const onDisconnect = () => setStatus('offline');
    const onReconnectAttempt = () => setStatus('reconnecting');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('reconnect_attempt', onReconnectAttempt);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('reconnect_attempt', onReconnectAttempt);
    };
  }, []);

  return status;
}