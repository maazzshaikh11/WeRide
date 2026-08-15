/**
 * Standalone spoof detection state machine.
 * May be folded into Ekf if small — kept separate for testability.
 * Ported from spoof_detector.dart.
 *
 * Tracks NIS threshold crossings and manages the spoof_flag lifecycle.
 */

export interface SpoofDetectorParams {
  threshold: number;
  triggerTicks?: number;
  recoveryTicks?: number;
}

export class SpoofDetector {
  readonly threshold: number;
  readonly triggerTicks: number;
  readonly recoveryTicks: number;

  private _flagged = false;
  private _aboveCount = 0;
  private _belowCount = 0;

  constructor(params: SpoofDetectorParams) {
    this.threshold = params.threshold;
    this.triggerTicks = params.triggerTicks ?? 3;
    this.recoveryTicks = params.recoveryTicks ?? 5;
  }

  get isFlagged(): boolean {
    return this._flagged;
  }

  /** Feed a NIS score, returns the current spoof_flag. */
  update(nis: number): boolean {
    if (this._flagged) {
      if (nis < this.threshold) {
        this._belowCount++;
        if (this._belowCount >= this.recoveryTicks) {
          this._flagged = false;
          this._belowCount = 0;
          this._aboveCount = 0;
        }
      } else {
        this._belowCount = 0;
      }
    } else {
      if (nis > this.threshold) {
        this._aboveCount++;
        if (this._aboveCount >= this.triggerTicks) {
          this._flagged = true;
          this._belowCount = 0;
        }
      } else {
        this._aboveCount = 0;
      }
    }
    return this._flagged;
  }
}