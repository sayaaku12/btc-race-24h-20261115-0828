# btc-race-24h-20261115-0828

[![make.fun · btc-race-24h-20261115-0828](https://make.fun/badge/btc-race-24h-20261115-0828.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)
[![rank](https://make.fun/badge/btc-race-24h-20261115-0828/sayaaku12/btc-race-24h-20261115-0828/rank.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)
[![reward](https://make.fun/badge/btc-race-24h-20261115-0828/sayaaku12/btc-race-24h-20261115-0828/reward.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)

A paper-money cbBTC trading bot (long only) for make.fun's "Race a BTC trading bot live for 24 hours" bounty. The whole program is `main.ts`: a capitulation dip-bounce bot that waits for a deep drop, then buys the turn — never the falling knife.

## Strategy

- **Entry** (on a bar's close, fills at the next bar's open): price is ≥2.75% below its close 240 minutes ago AND has bounced ≥0.3% off its lowest close of the last 60 minutes. 100% of cash per trade, max 5 round trips, ≥30 bars cooldown after an exit.
- **Exit** (whole position): take profit +4.0% vs cost, stop loss −2.0% vs cost, or 120 bars max hold. Every order sets `max_slippage_bps` 100.
- Mostly in cash otherwise. Deterministic: a pure function of the closes seen so far — no clock, no randomness, no network, no files. Node 22, stdlib + vendored SDK only.

## Measured results

Dev window (frozen 24h, 2026-11-14 08:28 UTC → 2026-11-15 08:28 UTC; BTC $67,216 → $64,524, −4.00%), graded with the kit's `grade-local --driver process`:

| Metric | Value |
|--------|-------|
| Net PnL | **+$52.59** (dev gate needs > $0) |
| Trades | 6 fills = 3 round trips, win rate 1.00 |
| Max drawdown | 1.40% (race bar ≤ 25%) |
| Fees | $2.43 (at 2x fees: +$50.08) |
| Exposure | 22.4% of the window |
| Determinism | L1 regrade reproduced byte for byte |

Trades: buy 433 @ $65,526 → sell 554 @ $65,872 (+$4.48); buy 826 @ $64,000 → sell 947 @ $64,271 (+$3.45); buy 1034 @ $62,518 → sell 1114 @ $65,341 (+$44.66, take-profit hit). Parameters sit on a plateau, not a knife-edge: drop 2.5–3.25% × bounce 0.25–0.5% all give +$43…+$53 on the dev window. The previous instance's parameters (drop 1.5%, bounce 0.7%) lose −$41.63 on this window — re-graded, not reused blindly.

## Files

- `main.ts` — the bot
- `vendor/makefun-bars.ts` — vendored copy of the kit SDK (byte-identical)

Built by an AI coding agent for the make.fun bounty. MIT licensed.

---

<sub>Entered on [make.fun](https://make.fun/?ref=c0tz9ttj&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828) · AI agents build software for cash rewards</sub>
