# Ball Crap — Session Handoff Document

## 1. Project Overview

**Ball Crap** is a card/dice American football game web app (1P vs AI + online 1v1).

**Tech stack**: Single self-contained HTML file (`index.html`, ~3113 lines). All CSS in `<style>`, all JS in `<script>`. No dependencies, no Node.js locally. Opens directly in a browser.

**File**: `C:\Users\edr_2\OneDrive\Desktop\Claude Projects\Ball_01\index.html`

**Relay server**: `server/relay.js` (Node.js + ws), deployed to Render at `https://ball-crap.onrender.com`

**GitHub**: `https://github.com/delgado-plus/ball-crap` — branch `multiplayer` has all online work; `master` is stable 1P AI only.

**GitHub Pages**: Live at `https://delgado-plus.github.io/ball-crap/` (serves `multiplayer` branch)

**PR**: https://github.com/delgado-plus/ball-crap/pull/1 (multiplayer → master)

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
A=14, K=13, Q=12, J=11, 2-10=face value

### Betting
- **Pot** = 2x buy-in. Football winner takes pot.
- **Side bets** after each card placement: 6 bidirectional rounds
  - Defense bets first → offense responds (match/raise/pass) → defense matches
  - Offense initiates on $0 positions → defense responds → offense matches
- Pass/fold penalty = 10% of buy-in
- Wallet keys always `'player'` and `'ai'`
- **Bet step size**: `Math.max(1, Math.floor(buyIn / 5))` — $2 increments with $10 buy-in

---

## 3. Architecture

### Side Naming — CRITICAL
**Always use `'player'`/`'ai'` as side keys in ALL modes.**
In online mode: host = `'player'`, guest = `'ai'`. Only `isLocalSide()` knows the mapping.

```javascript
let gameMode = 'ai';    // 'ai' or 'online'
let playerRole = null;  // 'host' or 'guest' (online only)
let onlineConfig = null; // { buyIn, startingBalance } set in lobby

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

// Returns position label from local player's perspective
function betPosLabel(pos, state) {
  const pIsOff = isLocalSide(state.drive.offenseSide);
  if (pIsOff) return posLabel(pos);   // WR1, RB, WR2
  return posLabel(MATCHUPS[pos]);     // CB1, DB, CB2
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

### WebSocket Module
```javascript
netConnect(url)     // returns Promise, resolves on open
netSend(obj)        // JSON stringify + send
waitForNetMessage() // returns Promise<parsed message>
netDisconnect()     // close socket
```

---

## 4. Online Multiplayer — Current State

### What Works
- Mode select: Play vs AI / Create Game (host) / Join Game (guest)
- **Host lobby flow**: Set Bets → config locks → Create Room appears → 4-letter code
- **Guest lobby flow**: Join Room only (no config — receives host's config via CONFIG message)
- Relay server live on Render, WebSocket connections confirmed
- Host sends CONFIG message on OPPONENT_JOINED; guest applies it
- Config bar hidden during online games — neither player can modify
- Card placement sync (OFFENSE_DONE / DEFENSE_DONE messages)
- Dice sync (host rolls, sends DICE message to guest)
- All 6 betting rounds guarded with `&& !isOnline()` to prevent AI auto-play
- All 6 betting rounds have online paths via `localIsDef`/`localIsOff` + `netSend`/`waitForNetMessage`
- Bet result labels show "Offense wins" / "Defense wins" (not "AI wins")
- Copyright visible on all screens (z-index 250)

### Message Types Used
```
CONFIG          — host sends buy-in/balance config to guest on join
DEAL            — host sends dealt cards to guest
OFFENSE_DONE    — offense player sends their placements
DEFENSE_DONE    — defense player sends their placements
ROCK_DONE       — offense player sends rock position
FOURTH_DOWN     — host sends 4th down choice (FG or try)
DICE            — host sends dice roll results to guest
DEFENSE_BETS    — local defense sends bet amounts
OFFENSE_RESPONSES — local offense sends match/raise/pass
DEFENSE_MATCHED — local defense sends match decision
OFFENSE_BETS    — local offense sends initiated bets
DEF_RESPOND_OFF — local defense responds to offense bets
OFFENSE_MATCHED — local offense sends match decision
```

---

## 5. CURRENT BUG — MUST FIX FIRST

### Betting panel labels + card visibility during betting

**Problem**: In the betting panel UI (the bottom panel with mini cards and +/- controls):
1. When on **defense**, the position labels show offense names (WR1, RB) instead of defense names (CB1, DB)
2. The local player's own cards are shown face-up in the mini card area — they should be **face-down** for both sides during betting, so neither player sees card values before reveal
3. Face-down mini cards in the betting panel need a **position label** (CB1, WR1, etc.) so the player knows which matchup they're betting on

**What was already done**:
- `betPosLabel(pos, state)` helper created — returns CB1/DB/CB2 when on defense, WR1/RB/WR2 when on offense
- All 7 `posLabel(pos)` calls in betting panels replaced with `betPosLabel(pos, state)`
- All 4 `state.drive.offenseSide === 'player'` checks in betting panels replaced with `isLocalSide(state.drive.offenseSide)`
- Face-down field cards now show "CB1?" / "WR1?" overlay via `.card__hidden-label` CSS class

**What still needs fixing**:
- The **mini cards** in betting panels (created by `createMiniCard()`) that are face-down need a position label overlay, similar to how `renderSlotCard` adds `.card__hidden-label`
- Verify that `betPosLabel` is actually being called correctly in all 7 betting panel functions — the eval test showed it works (`betPosLabel('wr1', defDrive) === 'CB1'`) but the user reports it's still showing WR1 when on defense
- The betting panel label on line 1281 shows `betPosLabel(pos, state)` but the **mini card label** (separate from the row label) next to the face-down card still needs the opponent's position

**Files to check**: `waitForDefenseBet` (~line 1258), `waitForOffenseResponse` (~line 1340), `waitForDefenseMatch` (~line 1460), `waitForOffenseInitiateBet` (~line 1530), `waitForDefenseRespondToOffBet` (~line 1600), `waitForOffenseMatchDefRaise` (~line 1720), `showBetResults` (~line 1890)

**How `createMiniCard` works** (search for `function createMiniCard`): Creates a small card element. When `faceDown=true`, it shows the card back. Need to add a label overlay like the field cards have.

---

## 6. Function Map (approximate line numbers, ~3113-line file)

| Area | Lines | Key Functions |
|------|-------|---------------|
| Utils | ~625 | `sleep`, `randomInt`, `$`, `$$`, `el` |
| Mode Select & Networking | ~640 | `selectMode`, `selectJoin`, `lobbySetConfig`, `lobbyResetConfig`, `lobbyBack`, `showModeSelect`, `createRoom`, `joinRoom` |
| WebSocket | ~760 | `netConnect`, `netSend`, `waitForNetMessage`, `netDisconnect` |
| Online Helpers | ~810 | `isOnline`, `isLocalSide`, `sideLabel` |
| Deck | ~830 | `createDeck`, `shuffleDeck`, `dealCards` |
| Rules | ~850 | `rollDice`, `resolveDown` |
| AI Cards | ~870 | `aiSortCards`, `aiPlaceDefense`, `aiPlaceOffense`, `aiFourthDownDecision` |
| Betting Helpers | ~920 | `getNonRockPositions`, `getCardStrength`, `posLabel`, `betPosLabel`, `renderWallets`, `readConfigToState`, `applyConfig`, `waitForConfig`, `unlockConfig`, `getDefenseSide` |
| AI Betting | ~1080 | `aiBetAsDefense`, `aiBetAsOffenseResponse`, `aiBetDefenseMatch`, `aiBetAsOffenseInitiate`, `aiBetDefenseRespond`, `aiBetOffenseMatchRaise` |
| Player Betting UI | ~1250 | `waitForDefenseBet`, `waitForOffenseResponse`, `waitForDefenseMatch`, `waitForOffenseInitiateBet`, `waitForDefenseRespondToOffBet`, `waitForOffenseMatchDefRaise` |
| Bet Resolution | ~1880 | `resolveCardComparison`, `resolveBets`, `showBetResults` |
| Card/Dice UI | ~1930 | `createCardEl`, `createMiniCard`, `flipCard`, `createDie`, `setDie`, `animateDice` |
| UI Helpers | ~1970 | `renderScoreboard`, `renderGameInfo`, `renderSlotCard`, `renderField`, `renderHand`, `setInstruction`, `showResult`, `setActionBtn`, `showMessage`, `showFourthDownChoice` |
| Player Input | ~2150 | `waitForPlacement`, `waitForRock`, `clearAllSlotHandlers`, `waitForNext` |
| Game Engine | ~2290 | `checkAbort`, `restartGame`, `createState`, `resetDrive`, `resetDown`, `ensureDeck`, `executeDown`, `executePossession`, `executeOvertimePossession`, `startGame` |

---

## 7. executeDown Flow

```
1. Player on offense:
   OFFENSE_PLACE_CARDS → PLACE_ROCK → DEFENSE_PLACE_CARDS (AI auto or remote)

2. AI/remote on offense:
   OFFENSE_PLACE_CARDS (AI auto or remote) → DEFENSE_PLACE_CARDS (local)

3. BETTING SEQUENCE (6 rounds):
   DEFENSE_BET → OFFENSE_RESPOND → DEFENSE_MATCH (if raised)
   → OFFENSE_BET (on $0 positions) → DEFENSE_RESPOND_OFF → OFFENSE_MATCH (if raised)

4. REVEAL → DICE_ROLL (if pass) → RESOLVE_DOWN → BET_RESULTS → NEXT
```

---

## 8. Pending Work (Priority Order)

1. **[BUG] Fix betting panel labels + mini card labels** — see Section 5 above
2. **Verify online betting** — Test online mode full betting flow end-to-end
3. **Game-over for online** — winner announced, rematch option returns to lobby
4. **Polish**: timeout handling, reconnection if WebSocket drops
5. **Pass/fold unification** — both exist with same penalty, unify to one term
6. **Visual Phase 2** — football field layout improvements
7. **Spectator Betting Expansion** — see memory file `project_spectator_betting.md`

---

## 9. HTML Structure

```
body
  .mode-select (fullscreen overlay)
    .mode-select__buttons (Play vs AI / Create Game / Join Game)
    .lobby
      #lobbyConfig (buy-in + balance inputs + Set Bets button — host only)
      #lobbyCreate (Create button + room code — appears after Set)
      #lobbyJoin (code input + Join button — guest only)
  button.restart-btn
  div.copyright (z-index 250)
  .conn-status (online connection indicator)
  #app
    .config-bar (buy-in + balance inputs + Set button — hidden in online mode)
    .wallet-bar (player credits | pot | AI credits)
    .scoreboard
    .game-info (drive | down | yard line)
    .phase-instruction
    .result-display
    .field (defense row | matchup lines | offense row)
    .dice-area
    .hand
    .betting-panel
    .actions
  .message-overlay
```

---

## 10. Project Files

```
Ball_01/
  index.html          — The game (~3113 lines), multiplayer branch
  HANDOFF.md          — This document
  server/
    relay.js          — Node.js WebSocket relay (~105 lines)
    package.json      — Just ws dependency
  serve.ps1/bat/sh    — Local HTTP server scripts
  .claude/launch.json — Preview server config (port 3001, serve.bat)
```

---

## 11. Dev Setup

- **Local preview**: Run `serve.bat` (or `serve.ps1`), open `http://localhost:3001`
- **Two-player local test**: Open in two **separate browser windows** (not tabs — tabs share JS state and break the game)
- **Relay URL**: `wss://ball-crap.onrender.com` (hardcoded in `netConnect()`)
- **Git**: `master` = stable AI-only; `multiplayer` = all online work
- **GitHub Pages**: `multiplayer` branch → `https://delgado-plus.github.io/ball-crap/`

---

## 12. Uncommitted Changes

There are uncommitted changes in `index.html` on the `multiplayer` branch that include:
- `betPosLabel()` helper function added
- All betting panel `posLabel(pos)` → `betPosLabel(pos, state)`
- All betting panel `offenseSide === 'player'` → `isLocalSide(state.drive.offenseSide)`
- Face-down field cards show position label + `?` via `.card__hidden-label` CSS
- `.card__hidden-label` CSS class added

These changes are **partially working** — the `betPosLabel` function returns correct values but the user reports labels still show WR1 when on defense. Needs debugging.
