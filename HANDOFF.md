# Ball Crap — Session Handoff Document

## 1. Project Overview

**Ball Crap** is a card/dice American football game web app (1P vs AI + online 1v1).

**Tech stack**: Single self-contained HTML file (`index.html`, ~2986 lines). All CSS in `<style>`, all JS in `<script>`. No dependencies, no Node.js locally. Opens directly in a browser.

**File**: `C:\Users\edr_2\OneDrive\Desktop\Claude Projects\Ball_01\index.html`

**Relay server**: `server/relay.js` (Node.js + ws), deployed to Render at `https://ball-crap.onrender.com`

**GitHub**: `https://github.com/delgado-plus/ball-crap` — branch `multiplayer` has all online work; `master` is stable 1P AI only.

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

---

## 3. Architecture

### Side Naming — CRITICAL
**Always use `'player'`/`'ai'` as side keys in ALL modes.**
In online mode: host = `'player'`, guest = `'ai'`. Only `isLocalSide()` knows the mapping.

```javascript
let gameMode = 'ai';    // 'ai' or 'online'
let playerRole = null;  // 'host' or 'guest' (online only)

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
```

`sideToWalletKey()`, `localWalletKey()`, `remoteWalletKey()` were REMOVED — no longer needed.

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

### WebSocket Module (~lines 740-790)
```javascript
netConnect(url)     // returns Promise, resolves on open
netSend(obj)        // JSON stringify + send
waitForNetMessage() // returns Promise<parsed message>
netDisconnect()     // close socket
```

---

## 4. Online Multiplayer — Current State

### What Works
- Mode select screen (Play vs AI / Play Online)
- Lobby UI: Create Room (4-letter code), Join Room
- Relay server live on Render, WebSocket connections confirmed
- Host/guest roles established, OPPONENT_JOINED syncs both sides
- Card placement sync (OFFENSE_DONE / DEFENSE_DONE messages)
- Dice sync (host rolls, sends DICE message to guest)
- All 6 betting rounds have online paths:
  - `defSide === 'ai'` → AI auto
  - `localIsDef`/`localIsOff` → local player UI + `netSend`
  - else → `waitForNetMessage()` (remote player)

### Message Types Used
```
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

### Last Known Bug — RESOLVED
~~Clicking "Set" in AI mode doesn't advance the game.~~ **Fixed** — verified 2026-04-07. Set button works correctly: buy-in deducts, pot fills, overlay appears, card placement and betting all functional in AI mode.

---

## 5. Function Map (line numbers, 2986-line file)

| Area | Lines | Key Functions |
|------|-------|---------------|
| Utils | ~455 | `sleep`, `randomInt`, `$`, `$$`, `el` |
| Deck | ~474 | `createDeck`, `shuffleDeck`, `dealCards` |
| Rules | ~492 | `rollDice`, `resolveDown` |
| AI Cards | ~512 | `aiSortCards`, `aiPlaceDefense`, `aiPlaceOffense`, `aiFourthDownDecision` |
| Online UI | ~617 | `showModeSelect`, `hideModeSelect`, `showLobby`, `createRoom`, `joinRoom` |
| WebSocket | ~740 | `netConnect`, `netSend`, `waitForNetMessage`, `netDisconnect` |
| Online Helpers | ~795 | `isOnline`, `isLocalSide`, `sideLabel` |
| Betting Helpers | ~830 | `getNonRockPositions`, `getCardStrength`, `posLabel`, `renderWallets`, `readConfigToState`, `applyConfig`, `waitForConfig`, `unlockConfig`, `getDefenseSide` |
| AI Betting | ~997 | `aiBetAsDefense`, `aiBetAsOffenseResponse`, `aiBetDefenseMatch`, `aiBetAsOffenseInitiate`, `aiBetDefenseRespond`, `aiBetOffenseMatchRaise` |
| Player Betting UI | ~1150 | `waitForDefenseBet`, `waitForOffenseResponse`, `waitForDefenseMatch`, `waitForOffenseInitiateBet`, `waitForDefenseRespondToOffBet`, `waitForOffenseMatchDefRaise` |
| Bet Resolution | ~1500 | `resolveCardComparison`, `resolveBets`, `showBetResults` |
| Card/Dice UI | ~1650 | `createCardEl`, `flipCard`, `createDie`, `setDie`, `animateDice` |
| UI Helpers | ~1700 | `renderScoreboard`, `renderGameInfo`, `renderField`, `renderHand`, `setInstruction`, `showResult`, `setActionBtn`, `showMessage`, `showFourthDownChoice` |
| Player Input | ~1870 | `waitForPlacement`, `waitForRock`, `clearAllSlotHandlers`, `waitForNext` |
| Game Engine | ~2100 | `checkAbort`, `restartGame`, `createState`, `resetDrive`, `resetDown`, `ensureDeck`, `executeDown`, `executePossession`, `executeOvertimePossession`, `startGame` |

---

## 6. executeDown Flow

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

## 7. Pending Work (Priority Order)

1. ~~**[BLOCKER] Fix Set button / applyConfig bug**~~ — RESOLVED 2026-04-07
2. **Verify online betting** — Test online mode full betting flow end-to-end
3. **Game-over for online** — winner announced, rematch option returns to lobby
4. **Polish**: timeout handling, reconnection if WebSocket drops
5. **Pass/fold unification** — both exist with same penalty, unify to one term
6. **Visual Phase 2** — football field layout improvements

---

## 8. HTML Structure

```
body
  button.restart-btn
  div.copyright
  .mode-select (fullscreen overlay: Play vs AI / Play Online)
    .lobby (Create Room / Join Room)
  .conn-status (online connection indicator)
  #app
    .config-bar (buy-in + balance inputs + Set button)
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

## 9. Project Files

```
Ball_01/
  index.html          — The game (~2986 lines), multiplayer branch
  HANDOFF.md          — This document
  server/
    relay.js          — Node.js WebSocket relay (~105 lines)
    package.json      — Just ws dependency
  serve.ps1/bat/sh    — Local HTTP server scripts
  .claude/launch.json — Preview server config (port 3001, serve.bat)
```

---

## 10. Dev Setup

- **Local preview**: Run `serve.bat` (or `serve.ps1`), open `http://localhost:3001`
- **Two-player local test**: Open in two **separate browser windows** (not tabs — tabs share JS state and break the game)
- **Relay URL**: `wss://ball-crap.onrender.com` (hardcoded in `netConnect()` call in `showLobby()`)
- **Git**: `master` = stable AI-only; `multiplayer` = all online work
