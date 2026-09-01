/**
 * Phase 4: Offline-Resilient Local Queue
 * 
 * MMKV-backed persistent queue for hazard reports and SOS operations.
 * Survives app restart. Zero data loss: writes are synchronous.
 * 
 * Queue operations are FIFO. Retry count persists across restarts.
 * Operations with retry_count > 3 are dropped by sync worker.
 */

import type { HazardReport } from '../dbscan/dbscan';
import type { SOSElement } from './orSet';

// We cannot instantiate MMKV at module load time due to ts-jest mocking bugs.
// Lazily instantiate it using the same pattern as HLC and OR-Set.
// We cannot use ES6 import due to ts-jest mocking - same pattern as HLC and OR-Set
/* eslint-disable-next-line @typescript-eslint/no-require-imports */
const MMKV = require('react-native-mmkv').MMKV;

/**
 * Queued operation interface.
 * Persisted to MMKV as JSON array under queue name key.
 */
export interface QueuedOperation {
  id: string;
  type: 'hazard_report' | 'sos_event' | 'sos_resolve';
  data: HazardReport | SOSElement | { sos_id: string; resolved_at_hlc: string };
  created_at_hlc: string;
  retry_count: number;
}

/**
 * Queue name constants.
 * Use these to avoid typos and ensure consistency.
 */
export const HAZARD_QUEUE = 'hazard_queue';
export const SOS_QUEUE = 'sos_queue';

// Lazily instantiate MMKV to avoid ts-jest mocking issues
let _queueStorage: any | null = null;
function getQueueStorage(): any {
  if (!_queueStorage) {
    /* eslint-disable-next-line @typescript-eslint/no-unsafe-call */
    _queueStorage = new MMKV({ id: 'offline_queue' });
  }
  return _queueStorage;
}

/**
 * Enqueue an operation to the specified queue.
 * 
 * - Reads existing queue from MMKV
 * - Appends new operation
 * - Writes back to MMKV synchronously
 * - Preserves FIFO ordering
 * 
 * @param queueName - Queue identifier (use HAZARD_QUEUE or SOS_QUEUE)
 * @param operation - Operation to enqueue
 */
export function queueEnqueue(
  queueName: string,
  operation: QueuedOperation
): void {
  const storage = getQueueStorage();
  const queue = queuePeek(queueName);
  
  // Append to queue
  queue.push(operation);
  
  // Persist synchronously
  storage.set(queueName, JSON.stringify(queue));
}

/**
 * Remove an operation from the queue by ID.
 * 
 * - Reads existing queue
 * - Filters out operation with matching ID
 * - Persists updated queue synchronously
 * - Idempotent: safe to call with nonexistent ID
 * 
 * @param queueName - Queue identifier
 * @param operationId - ID of operation to remove
 */
export function queueDequeue(
  queueName: string,
  operationId: string
): void {
  const storage = getQueueStorage();
  const queue = queuePeek(queueName);
  
  // Filter out the operation
  const updated = queue.filter(op => op.id !== operationId);
  
  // Persist synchronously
  storage.set(queueName, JSON.stringify(updated));
}

/**
 * Peek at all operations in the queue without modifying it.
 * 
 * - Returns array in FIFO order (oldest first)
 * - Returns empty array if queue doesn't exist
 * - Handles corrupted JSON safely
 * 
 * @param queueName - Queue identifier
 * @returns Array of queued operations (empty if queue doesn't exist)
 */
export function queuePeek(
  queueName: string
): QueuedOperation[] {
  const storage = getQueueStorage();
  const saved = storage.getString(queueName);
  
  if (!saved) {
    return [];
  }
  
  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed as QueuedOperation[];
  } catch (e) {
    // Corrupted JSON - return empty queue
    console.error(`[localQueue] Failed to parse queue ${queueName}:`, e);
    return [];
  }
}

/**
 * Update the retry count for a queued operation.
 * 
 * Internal helper used by sync worker when operation fails.
 * 
 * @param queueName - Queue identifier
 * @param operationId - ID of operation to update
 * @param retryCount - New retry count value
 */
export function queueUpdateRetry(
  queueName: string,
  operationId: string,
  retryCount: number
): void {
  const storage = getQueueStorage();
  const queue = queuePeek(queueName);
  
  // Find and update the operation
  const updated = queue.map(op => {
    if (op.id === operationId) {
      return { ...op, retry_count: retryCount };
    }
    return op;
  });
  
  // Persist synchronously
  storage.set(queueName, JSON.stringify(updated));
}

/**
 * Get the count of operations in a queue.
 * 
 * @param queueName - Queue identifier
 * @returns Number of operations in queue
 */
export function queueSize(queueName: string): number {
  return queuePeek(queueName).length;
}

/**
 * Clear all operations from a queue.
 * 
 * WARNING: This permanently deletes all queued operations.
 * Use only for testing or explicit user action.
 * 
 * @param queueName - Queue identifier
 */
export function queueClear(queueName: string): void {
  const storage = getQueueStorage();
  const saved = storage.getString(queueName);
  if (saved) {
    storage.delete(queueName);
  }
}

/**
 * Reset storage for testing.
 * @internal
 */
export function _resetQueueStorage(): void {
  if (_queueStorage) {
    _queueStorage.clearAll();
  }
  _queueStorage = null;
}


