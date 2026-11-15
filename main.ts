// Dip-bounce bot for make.fun "Race a BTC trading bot live for 24 hours"
// (btc-race-24h-20261115-0828). Long only, $1,000 paper, cbBTC 1-minute bars.
//
// The dev window for THIS instance (2026-11-14 08:28 UTC -> 2026-11-15 08:28 UTC,
// BTC $67,216 -> $64,524, -4.00%) is a slow grind down to $62,082 (01:46 UTC)
// then a sharp V-recovery (+4.5% off the low). The parameters from the previous
// instance (btc-race-24h-20261113-2314: drop 1.5%, bounce 0.7%) FAIL here:
// they fire three times mid-grind and stop out (-$41.63 on grade-local).
// This instance needs a deeper drop filter (2.75% over 240 min) so the bot
// stays out of the grind, and a smaller bounce confirmation (0.3%) so it
// still catches the turn. Verified with an exact-fill offline simulator
// (fill math ported from the kit harness, calibrated to grade-local to the
// cent on the old parameters: sim -$41.63 vs grader -$41.63).
//
// Entry (all conditions, on a bar's close; fills at the next bar's open):
//   - price is >= 2.75% below its close 240 minutes ago (a real drop, not noise)
//   - price has bounced >= 0.3% off its lowest close of the last 60 minutes
//     (the fall has actually turned)
//   - no position held, fewer than 5 round trips used, >= 30 bars since the
//     last exit (no immediate re-entry churn)
// Exit (whole position, 100% of cash per trade):
//   - take profit +4.0% vs cost, stop loss -2.0% vs cost, or 120 bars max hold
//   - max_slippage_bps 100 on every order (1% past the deciding close)
// Mostly in cash otherwise. Parameters sit on a plateau, not a knife-edge:
// on the dev window DROP_PCT 2.5-3.25% x CONFIRM_PCT 0.25-0.5% all give
// +$43..+$53 with the same 2-3 trades (see NOTES.md); chosen values sit
// mid-plateau (2.75% / 0.30%). TP 1-6% all stay positive (+$15..+$53).
//
// Dev grade (grade-local, --driver process): net PnL +$52.59, 3 round trips,
// 3 wins, max drawdown 1.40%, fees $2.43. Trades: buy 433 @ $65,526 -> sell
// 554 @ $65,872 (+$4.48); buy 826 @ $64,000 -> sell 947 @ $64,271 (+$3.45);
// buy 1034 @ $62,518 -> sell 1114 @ $65,341 (+$44.66, TP hit).
//
// Deterministic: pure function of the closes seen so far; no clock, no
// randomness, no network, no files. Stdlib + vendored SDK only.

import { runBars, type BarsState, type Batch } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const DROP_WINDOW = 240; // minutes of history the drop is measured over
const DROP_PCT = 0.0275; // entry needs a >= 2.75% drop over DROP_WINDOW
const CONFIRM_WINDOW = 60; // minutes of history the bounce low is measured over
const CONFIRM_PCT = 0.003; // entry needs a >= 0.3% bounce off that low
const TAKE_PROFIT = 0.04;
const STOP_LOSS = 0.02;
const MAX_HOLD_BARS = 120;
const MAX_TRADES = 5;
const COOLDOWN_BARS = 30;
const MAX_SLIPPAGE_BPS = 100;

const closes: number[] = [];
let entrySeq = -1;
let buys = 0;
let lastExitSeq = -1_000_000;
let prevHeld = false;

function rollingLow(n: number): number {
  let lo = Infinity;
  for (let i = Math.max(0, closes.length - n); i < closes.length; i++) {
    if (closes[i] < lo) lo = closes[i];
  }
  return lo;
}

// Entry gate: deep drop + confirmed bounce, with trade budget and cooldown.
// Same checks, same order as the inline version: budget, cooldown, enough
// history, drop, then bounce. Returns true only when all of them pass.
function shouldEnter(now: number, seq: number): boolean {
  if (buys >= MAX_TRADES) return false;
  if (seq - lastExitSeq < COOLDOWN_BARS) return false;
  if (closes.length <= DROP_WINDOW) return false;
  if (now / closes[closes.length - 1 - DROP_WINDOW] - 1 > -DROP_PCT) return false;
  if (now / rollingLow(CONFIRM_WINDOW) - 1 < CONFIRM_PCT) return false;
  return true;
}

// Exit gate: take profit, stop loss, or max hold, on value vs cost.
// Same comparison as the inline version: return vs cost, in the same order.
function shouldExit(value: bigint, cost: bigint, seq: number): boolean {
  const ret = Number(value) / Number(cost) - 1;
  return ret >= TAKE_PROFIT || ret <= -STOP_LOSS || seq - entrySeq >= MAX_HOLD_BARS;
}

await runBars({
  onBatch(state: BarsState, batch: Batch) {
    if (state.warmingUp) return [];
    for (const bar of batch.bars) {
      if (bar.symbol === SYMBOL) closes.push(Number(bar.c) / 1e5);
    }
    if (!batch.bars.some((b) => b.symbol === SYMBOL)) return [];

    // Observe fills decided on the previous bar.
    for (const fill of batch.fills) {
      if (fill.symbol !== SYMBOL) continue;
      if (fill.side === 'buy' && fill.status === 'filled') buys++;
      if (fill.side === 'sell' && fill.status === 'filled') lastExitSeq = state.seq;
    }

    const held = state.positions.get(SYMBOL);
    if (held !== undefined && !prevHeld) entrySeq = state.seq;
    prevHeld = held !== undefined;
    if (held === undefined) {
      // Entry: deep drop + confirmed bounce (see shouldEnter), then the
      // min-notional check on cash before sending the whole-cash buy.
      const now = closes[closes.length - 1];
      if (!shouldEnter(now, state.seq)) return [];
      if (state.cash < BigInt(state.hello.fees.min_notional_quote_units)) return [];
      return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }

    // Exit: take profit, stop loss, or max hold (see shouldExit).
    const value = state.value(SYMBOL, held.qty);
    if (shouldExit(value, held.cost, state.seq)) {
      return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    return [];
  },
});
