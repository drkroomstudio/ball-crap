# Ball Crap — Handoff BC1 (Stable Snapshot Before Gameplay Redesign)

> **Purpose**: This handoff preserves the current stable state of Ball Crap before the upcoming "drastic gameplay changes." If the redesign doesn't work out, this document describes what to revert to and what was working as of 2026-04-09.

**Snapshot commit**: `43acc20` on branch `multiplayer`
**File size**: `index.html` ~3327 lines
**Live URL**: https://delgado-plus.github.io/ball-crap/
**Relay**: `wss://ball-crap.onrender.com` (always on, Render free tier)
**PR**: https://github.com/delgado-plus/ball-crap/pull/1 (multiplayer → master)

---

## 1. Project Overview

**Ball Crap** is a card/dice American football game web app (1P vs AI + online 1v1).

**Tech stack**: Single self-contained HTML file (`index.html`). All CSS in `<style>`, all JS in `<script>`. No dependencies, no local Node.js needed. Opens directly in a browser.

**File**: `C:\Users\edr_2\OneDrive\Desktop\Claude Projects\Ball_01\index.html`

**Relay server**: `server/relay.js` (Node.js + ws), deployed to Render at `https://ball-crap.onrender.com`

**GitHub**: `https://github.com/delgado-plus/ball-crap`
- `master` — stable 1P AI only
- `multiplayer` — all online work + this snapshot (served by GitHub Pages)

---

## 2. Core Game Rules (Quick Ref)

- **2 possessions**: player offense, then AI offense
- **Start at 20 yard line**, 10 yards for first down
- **3 downs per set**: 9 cards dealt, pick 3 per down (9→6→3)
- **Card placement**: Offense → WR1/RB/WR2. Defense → CB1/DB/CB2
- **The Rock**: offense designates one position as the play (Run=RB, Pass=WR1/WR2)
- **Resolution**: Rock pos card vs matched defender. Run=card values. Pass=card values + 2d6 each
- **Matchups**: `{rb:'db', wr1:'cb1', wr2:'cb2'}`
- **Scoring**: TD=7pts, FG=3pts (4th down option)
- **Overtime**: 3 downs from 5 yard line, no FG

### Card Values
A=14, K=13, Q=12, J=11, 2–10=face value
(Now visible inline in-game via the card value key below the field.)

### Betting
- **Pot** = 2× buy-in. Football winner takes pot.
- **Side bets** after each card placement: 6 bidirectional rounds
  - Defense bets first → offense responds (match/raise/pass) → defense matches
  - Offense initiates on $0 positions → defense responds → offense matches
- Pass/fold penalty = 10% of buy-in
- Wallet keys always `'player'` and `'ai'`
- **Bet step size**: `Math.max(1, Math.floor(buyIn / 5))` — $2 increments with $10 buy-in

---

## 3. What Changed Since Original HANDOFF.md

Three commits landed in this session, all preserved in this snapshot:

### Commit `0013e22` — Betting panel mini card fix
- `createMiniCard(card, faceDown, label)` gained optional `label` param
- When `faceDown=true` and `label` provided, adds `.card__hidden-label` overlay ("CB1?", "WR1?")
- All 4 betting functions (`waitForDefenseBet`, `waitForOffenseResponse`, `waitForOffenseInitiateBet`, `waitForDefenseRespondToOffBet`) now render **both** sides' mini cards as face-down with position labels — so neither player sees card values before reveal
- Labels use `posLabel(pos)` for offense positions and `posLabel(MATCHUPS[pos])` for defense positions
- `betPosLabel(pos, state)` helper for row labels (perspective-aware)

### Commit `5cd4585` — Tutorial tooltip system
- **Trigger**: On `selectMode('ai')`, `tutorialInit()` reads `localStorage.getItem('ballCrap_skipTutorial')`
- **"I've played before" checkbox** in the mode select panel persists the skip preference
- **16 tutorial tooltip stops**, gated by drive/down so they only fire the first time:
  - `startGame`: config bar, wallet bar, scoreboard, game info
  - `executeDown` (drive 1 down 1, player offense): hand, field, rock
  - Betting intro: side bets, offense response, offense initiate
  - `executeDown` (drive 2 down 1, player defense): defense placement, defense betting
  - Resolution (drive 1 down 1): reveal, dice (if pass), result, wallet settlement
- **Tooltip engine**: `tutorialShow(targetSel, text, arrowDir)` returns a Promise; `tutorialDismiss()` resolves it; `tutorialSkipAll()` turns off for the rest of the session
- **CSS classes**: `.tutorial-overlay`, `.tutorial-tooltip`, `.tutorial-highlight`, `.tutorial-toggle`
- **HTML container**: `#tutorialOverlay`, `#tutorialTooltip` with "Got It" and "Skip All" buttons

### Commit `43acc20` — Inline card value key + tooltip positioning fix
- **Card value key** added inline directly below the field inside `#app`:
  ```
  Card Values: A=14 K=13 Q=12 J=11 10–2=face
  ```
- CSS class `.card-key` at `font-size: 0.525rem` (50% bigger than initial)
- **Bug fix**: 3 tutorial tooltips that targeted `.betting-panel` (initially `display:none`) caused the game to stall after rock placement — `getBoundingClientRect()` returned zeros, tooltip positioned off-screen, Promise never resolved. Retargeted to `.phase-instruction` (always visible), arrow direction 'down' → 'up'.

---

## 4. Current "Stable Feature" Checklist

All of these work and are verified in this snapshot:

- [x] 1P vs AI full game flow (2 possessions, 3 downs each, OT if tied)
- [x] Offense card placement + rock selection
- [x] Defense card placement (AI)
- [x] Pass/Run resolution (dice on pass)
- [x] Scoring (TD=7, FG=3, 4th down FG option)
- [x] Overtime (3 downs from 5 yard line, no FG)
- [x] 6-round bidirectional side betting with correct labels
- [x] Face-down mini cards in betting panels with position labels
- [x] Wallet/pot settlement
- [x] Tutorial tooltip system (can be skipped via checkbox)
- [x] Inline card value key
- [x] Online multiplayer mode (lobby, host/guest, config sync, card/dice/bet sync)
- [x] Relay server deployed and always live
- [x] Copyright watermark visible on all screens

---

## 5. Architecture (Preserved)

### Side Naming — CRITICAL
**Always use `'player'`/`'ai'` as side keys in ALL modes.**
In online mode: host = `'player'`, guest = `'ai'`. Only `isLocalSide()` knows the mapping.

```javascript
let gameMode = 'ai';    // 'ai' or 'online'
let playerRole = null;  // 'host' or 'guest' (online only)
let onlineConfig = null;

function isOnline() { return gameMode === 'online'; }

function isLocalSide(side) {
  if (!isOnline()) return side === 'player';
  return (playerRole === 'host') ? side === 'player' : side === 'ai';
}

function sideLabel(side) {
  if (!isOnline()) return side === 'player' ? 'You' : 'AI';
  return isLocalSide(side) ? 'You' : 'Opponent';
}

function getDefenseSide(state) {
  return state.drive.offenseSide === 'player' ? 'ai' : 'player';
}

function betPosLabel(pos, state) {
  const pIsOff = isLocalSide(state.drive.offenseSide);
  if (pIsOff) return posLabel(pos);
  return posLabel(MATCHUPS[pos]);
}
```

### State Object
```javascript
{
  phase, scores:{player,ai}, driveNumber, totalDrives:4,
  drive:{ offenseSide, yardLine, downNumber, yardsGainedThisSet, yardsNeededForFirstDown, hasFirstDown },
  down:{ offensePlacements:{wr1,rb,wr2}, defensePlacements:{cb1,db,cb2}, rockPosition, offenseDice, defenseDice, result },
  deck:[], discardPile:[], isOvertime, overtimeRound,
  wallets:{player, ai}, buyIn, startingBalance, pot,
  bets:{ positions:[], defenseBets:{}, offenseResponses:{}, raiseAmounts:{},
         defenseMatched:{}, offenseBets:{}, offInitDefResponses:{},
         offInitDefRaises:{}, offInitOffMatched:{}, results:{} }
}
```

### Async Game Loop
- Async/await with Promise-based player input
- `gameId` increments on restart; `checkAbort(myId)` throws `'GAME_ABORTED'` if stale
- `clearAllSlotHandlers()` strips click handlers via cloneNode

---

## 6. Function Map (approximate line numbers, ~3327-line file)

| Area | Lines | Key Functions |
|------|-------|---------------|
| Utils | ~625 | `sleep`, `randomInt`, `$`, `$$`, `el` |
| Mode Select & Networking | ~640 | `selectMode`, `selectJoin`, lobby funcs, `createRoom`, `joinRoom` |
| WebSocket | ~760 | `netConnect`, `netSend`, `waitForNetMessage`, `netDisconnect` |
| Online Helpers | ~810 | `isOnline`, `isLocalSide`, `sideLabel` |
| Deck | ~830 | `createDeck`, `shuffleDeck`, `dealCards` |
| Rules | ~850 | `rollDice`, `resolveDown` |
| AI Cards | ~870 | `aiSortCards`, `aiPlaceDefense`, `aiPlaceOffense`, `aiFourthDownDecision` |
| Betting Helpers | ~920 | `getNonRockPositions`, `getCardStrength`, `posLabel`, `betPosLabel` |
| AI Betting | ~1080 | All 6 AI bet funcs |
| Player Betting UI | ~1250 | All 6 player bet waiters — **all use face-down labeled mini cards** |
| Bet Resolution | ~1880 | `resolveCardComparison`, `resolveBets`, `showBetResults` |
| Card/Dice UI | ~1930 | `createCardEl`, **`createMiniCard(card, faceDown, label)`**, `flipCard`, dice |
| UI Helpers | ~1970 | render/show helpers |
| Player Input | ~2150 | `waitForPlacement`, `waitForRock`, `clearAllSlotHandlers`, `waitForNext` |
| Tutorial System | ~2250 | `tutorialInit`, `tutorialShow`, `tutorialDismiss`, `tutorialSkipAll` |
| Game Engine | ~2400 | `checkAbort`, `restartGame`, `createState`, engine funcs, `startGame` |

Line numbers are approximate — search by function name.

---

## 7. How to Revert to This Snapshot

If the upcoming gameplay redesign needs to be rolled back:

```bash
# Option A: Reset multiplayer branch to this commit
git checkout multiplayer
git reset --hard 43acc20
git push --force-with-lease origin multiplayer

# Option B (safer): Create a snapshot branch now
git checkout multiplayer
git branch snapshot/bc1-stable 43acc20
git push origin snapshot/bc1-stable
```

**Recommendation**: Create `snapshot/bc1-stable` branch BEFORE starting the redesign work, so this version is preserved regardless of what happens to `multiplayer`.

---

## 8. Known Pending Work (Deferred)

These were on the roadmap but deferred pending the gameplay redesign:

1. **Online betting end-to-end test** — Code paths exist, needs full playthrough test
2. **Game-over for online** — Winner announced, rematch → lobby
3. **Reconnection handling** — If WebSocket drops mid-game
4. **Pass/fold unification** — Both terms exist with same penalty
5. **Visual Phase 2** — Football field layout polish
6. **Spectator Betting Expansion** — See `project_spectator_betting.md`

---

## 9. Project Files

```
Ball_01/
  index.html          — The game (~3327 lines), multiplayer branch
  HANDOFF.md          — Original handoff (pre-this-session)
  HandoffBC1.md       — This document (stable snapshot)
  server/
    relay.js          — Node.js WebSocket relay (~105 lines)
    package.json      — Just ws dependency
  serve.ps1/bat/sh    — Local HTTP server scripts
  .claude/launch.json — Preview server config (port 3001)
```

---

## 10. Dev Setup

- **Local preview**: Run `serve.bat` (or `serve.ps1`), open `http://localhost:3001`
- **Two-player local test**: Open in two **separate browser windows** (not tabs — tabs share JS state)
- **Relay URL**: `wss://ball-crap.onrender.com` (hardcoded in `netConnect()`)
- **Live play**: https://delgado-plus.github.io/ball-crap/

---

## 11. Snapshot Commit Details

```
43acc20 Add inline card value key and fix tutorial tooltip positioning
5cd4585 Add interactive tutorial tooltip system for new players
0013e22 Fix betting panel: hide all card values and add position labels on mini cards
```

All three pushed to `origin/multiplayer` and included in PR #1.

---

**End of HandoffBC1.** Good luck with the redesign. If it doesn't work out, you know where to come back to.
