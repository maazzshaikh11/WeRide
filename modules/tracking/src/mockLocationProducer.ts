/**
 * Mock verified_location producer (Week 1 Day 2 unblock).
 * Walks along a predefined polyline, emitting at 1 Hz.
 * Everyone builds against this until Week 4 integration swap.
 * Ported from mock_location_producer.dart.
 */

import { LocationPublisher, VerifiedLocationPayload } from './locationPublisher';

export interface MockLocationProducerParams {
  publisher: LocationPublisher;
  polyline: number[][]; // [[lat,lng],...]
  intervalMs?: number;
  speedMps?: number;
}

export class MockLocationProducer {
  private _publisher: LocationPublisher;
  private _polyline: number[][];
  private _intervalMs: number;
  private _speed: number;
  private _timer?: ReturnType<typeof setInterval>;
  private _idx = 0;

  constructor(params: MockLocationProducerParams) {
    this._publisher = params.publisher;
    this._polyline = params.polyline;
    this._intervalMs = params.intervalMs ?? 1000;
    this._speed = params.speedMps ?? 8.0;
  }

  start(): void {
    this._timer = setInterval(() => {
      const p = this._polyline[this._idx % this._polyline.length];
      const payload: VerifiedLocationPayload = {
        timestampHlc: `mock-${Date.now()}`,
        lat: p[0],
        lng: p[1],
        speedMps: this._speed,
        headingDeg: 0,
        spoofFlag: false,
        nisScore: 1.0,
        accuracyM: 5.0,
      };
      this._publisher.publish(payload);
      this._idx++;
    }, this._intervalMs);
  }

  stop(): void {
    if (this._timer) clearInterval(this._timer);
  }
}