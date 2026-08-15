/**
 * Logs local FL round state for the Privacy/FL status UI.
 * No server call needed — reads local state only.
 * Ported from fl_round_logger.dart.
 */

import { MMKV } from 'react-native-mmkv';

export interface RoundInfo {
  roundId: number;
  localLoss: number;
  participants: number;
  timestamp: string;
}

export class FlRoundLogger {
  private _mmkv: MMKV;

  constructor(mmkv: MMKV) {
    this._mmkv = mmkv;
  }

  logRound(round: RoundInfo): void {
    this._mmkv.set(`round_${round.roundId}`, JSON.stringify(round));
  }

  latestRound(): RoundInfo | null {
    const keys = this._mmkv.getAllKeys();
    if (keys.length === 0) return null;
    const last = keys[keys.length - 1];
    const val = this._mmkv.getString(last);
    return val ? JSON.parse(val) : null;
  }
}