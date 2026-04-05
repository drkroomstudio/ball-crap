# Ball Crap - Session Handoff Document

## 1. Project Overview

**Ball Crap** is a card/dice-based American football game played as a web app (1P vs AI). It combines football strategy with card placement, dice rolling, and a craps-inspired betting system.

**Tech stack**: Single self-contained HTML file (`index.html`, ~2429 lines). All CSS in `<style>`, all JS in `<script>`. No dependencies, no server, no Node.js. Opens directly in a browser.

**File**: `C:\Users\edr_2\OneDrive\Desktop\Claude Projects\Ball_01\index.html`

---

## 2. Core Game Rules

### Football Mechanics
- **Two possessions**: Player on offense first, then AI on offense
- **Start at 20 yard line**, need 10 yards for a first down
- **3 downs per set**: Each set deals 9 cards to offense and 9 to defense. Player picks 3 cards per down (hand shrinks 9 -> 6 -> 3)
- **Card placement**: Offense places on WR1, RB, WR2. Defense places on CB1, DB, CB2
- **The Rock**: Offense designates one position as the play (Run = RB, Pass = WR1 or WR2)
- **Resolution**: Rock position card vs matched defender. Run = card values only. Pass = card values + 2d6 each
- **Yards**: offense total - defense total (can be negative)
- **Scoring**: Touchdown = 7 pts, Field Goal = 3 pts (4th down choice)
- **Overtime**: 3 downs from 10 yard line, 9 cards, no FG allowed, both sides get a chance

### Card Values
- Standard 52-card deck. A=14, K=13, Q=12, J=11, 2-10=face value
- No special Ace behavior (was removed — Ace is just value 14)

### Position Matchups
```javascript
const MATCHUPS = {rb:'db', wr1:'cb1', wr2:'cb2'};
```

---

## 3. Betting System (Recently Added)

### Game-Level Betting
- **Configurable buy-in** (min $5) and **starting balance** — set via input fields on the board
- **"Set" button** locks the config and starts the game
- **Pot** = 2x buy-in. Winner of the football game takes the pot
- **Persistent wallets**: Balances carry over between games via `persistentWallets` variable. Only the buy-in is deducted each new game. First game uses starting balance.

### Per-Down Side Bets (Bidirectional Flow)
After both sides place cards and rock is set, the 2 non-rock positions become side-bet opportunities:

1. **Defense bets first** on each non-rock position (0 to 2x buy-in)
2. **If defense bet > 0**: Offense responds — Match / Raise / Pass
   - If offense raises: Defense can Match or Fold
3. **If defense bet $0**: Offense gets to initiate a bet on that position (0 to 2x buy-in)
   - If offense bet > 0: Defense responds — Match / Raise / Pass
   - If defense raises: Offense can Match or Fold

### Side Bet Resolution
- Higher card value at each position wins the wager
- Tied cards = push (money returned)
- **Pass/Fold penalty**: 10% of buy-in paid to the other side

### Bet State Fields
```javascript
bets: {
  positions: [],           // 2 non-rock offense position keys
  defenseBets: {},          // defense-initiated: { pos: amount }
  offenseResponses: {},     // { pos: 'match'|'raise'|'pass' }
  raiseAmounts: {},         // { pos: amount } for offense raises
  defenseMatched: {},       // { pos: true/false } for defense matching raises
  offenseBets: {},          // offense-initiated: { pos: amount }
  offInitDefResponses: {},  // defense response to offense bets: { pos: 'match'|'raise'|'pass' }
  offInitDefRaises: {},     // { pos: amount } for defense raises on offense bets
  offInitOffMatched: {},    // { pos: true/false } for offense matching defense raises
  results: {}               // final resolution per position
}
```

### AI Betting Logic
- **AI defense betting** (`aiBetAsDefense`): Based on card strength — high cards bet aggressively, low cards bet $0
- **AI offense response** (`aiBetAsOffenseResponse`): Strong cards match/raise, weak cards pass
- **AI offense initiate** (`aiBetAsOffenseInitiate`): Same strength-based logic for positions defense passed on
- **AI defense respond** (`aiBetDefenseRespond`): Responds to offense-initiated bets
- Card strength: `(value - 2) / 12` — maps 2->0, Ace(14)->1

### Visual: Bet Badges
Gold/orange/red badges appear on field cards showing bet amounts, raises, and pass/fold status. Rendered in `renderField()`.

---

## 4. Key Architecture Decisions

### Single HTML File
No Node.js on machine. Everything in one file — CSS in `<style>`, JS in `<script>`.

### Async/Await Game Loop
Game flow uses async/await with Promise-based player input:
- `waitForPlacement()` — click card in hand, click slot on field (with undo)
- `waitForRock()` — click position to designate run/pass
- `waitForDefenseBet()`, `waitForOffenseResponse()`, etc. — betting UI

### Abort-Safe Restart
- `gameId` increments on restart, `checkAbort(myId)` throws `'GAME_ABORTED'` if stale
- `clearAllSlotHandlers()` strips click handlers via `cloneNode(true) + replaceChild`

### State Object
```javascript
function createState() {
  return {
    phase:'GAME_START',
    scores:{player:0,ai:0},
    driveNumber:0, totalDrives:4,
    drive: { offenseSide, yardLine:20, downNumber:1, yardsGainedThisSet:0, yardsNeededForFirstDown:10, hasFirstDown:false },
    down: { offensePlacements:{wr1,rb,wr2}, defensePlacements:{cb1,db,cb2}, rockPosition, offenseDice, defenseDice, result },
    deck:[], discardPile:[], isOvertime:false, overtimeRound:0,
    wallets:{player:100, ai:100},
    buyIn:10, startingBalance:100, pot:0,
    bets:{ ... }  // see above
  };
}
```

### Persistent Wallets
`persistentWallets` variable (outside state) carries balances across games. Saved after each side bet resolution and at game end.

---

## 5. Function Map (line numbers as of 2429-line file)

### Utils (455-465)
`sleep`, `randomInt`, `$`, `$$`, `el`

### Deck (474-485)
`createDeck`, `shuffleDeck`, `dealCards`

### Rules (492-507)
`rollDice`, `resolveDown`

### AI - Card Play (512-558)
`aiSortCards`, `aiPlaceDefense`, `aiPlaceOffense`, `aiFourthDownDecision`

### Betting Helpers (566-645)
`getNonRockPositions`, `getCardStrength`, `posLabel`, `renderWallets`, `readConfigToState`, `applyConfig`, `waitForConfig`, `unlockConfig`, `showBettingPanel`, `hideBettingPanel`, `getDefenseSide`

### AI Betting (651-800)
`aiBetAsDefense`, `aiBetAsOffenseResponse`, `aiBetDefenseMatch`, `aiBetAsOffenseInitiate`, `aiBetDefenseRespond`, `aiBetOffenseMatchRaise`

### Player Betting UI (802-1345)
`createMiniCard`, `waitForDefenseBet`, `waitForOffenseResponse`, `waitForDefenseMatch`, `waitForOffenseInitiateBet`, `waitForDefenseRespondToOffBet`, `waitForOffenseMatchDefRaise`

### Bet Resolution (1349-1490)
`resolveCardComparison`, `resolveBets`, `showBetResults`

### Card/Dice UI (1492-1530)
`createCardEl`, `flipCard`, `createDie`, `setDie`, `animateDice`

### UI Helpers (1536-1715)
`renderScoreboard`, `renderGameInfo`, `renderSlotCard`, `renderField` (includes bet badges), `revealAllCards`, `showDiceArea`, `hideDiceArea`, `renderDiceRoll`, `setInstruction`, `showResult`, `hideResult`, `setActionBtn`, `showMessage`, `showFourthDownChoice`

### Player Input (1718-1855)
`renderHand`, `highlightSlots`, `clearSlotHL`, `waitForPlacement`, `waitForRock`, `clearAllSlotHandlers`, `waitForNext`

### Game Engine (1862-2429)
`checkAbort`, `restartGame`, `createState`, `resetDrive`, `resetDown`, `ensureDeck`, `executeDown` (includes full betting sequence), `executePossession`, `executeOvertimePossession`, `startGame`

---

## 6. executeDown Flow (the core loop)

```
1. Player offense path:
   OFFENSE_PLACE_CARDS -> PLACE_ROCK -> DEFENSE_PLACE_CARDS (AI auto)

2. AI offense path:
   OFFENSE_PLACE_CARDS (AI auto) -> DEFENSE_PLACE_CARDS (player)

3. BETTING SEQUENCE (both paths):
   DEFENSE_BET -> OFFENSE_RESPOND -> [DEFENSE_MATCH if raised]
   -> OFFENSE_BET (on $0 positions) -> DEFENSE_RESPOND_OFF -> [OFFENSE_MATCH if raised]

4. REVEAL -> DICE_ROLL (if pass) -> RESOLVE_DOWN -> BET_RESULTS -> NEXT
```

---

## 7. Bugs Fixed (Historical)

- Negative yards ignored (was using Math.max(0)) -> fixed to count losses
- Rock clickable during defense -> fixed with clearAllSlotHandlers
- 3rd and 0 impossible state -> first down check moved inside per-down loop
- AI kicks FG when trailing by 7 -> aiFourthDownDecision made score-aware
- Dice pips invisible -> explicit width/height/min-width/min-height + background
- "& Goal" only on 1st down -> shows on all downs when hasFirstDown=true
- Balance resetting each game -> persistentWallets carries over
- AI not betting sometimes -> reverted forced minimum, added bidirectional flow
- "& Goal" not showing inside 10-yard line -> now triggers when `yardLine <= 10` (not just hasFirstDown)
- OT too hard to score -> yard line reduced from 10 to 5
- OT intro message wrong ("1 down each, 3 cards") -> fixed to "3 downs each, 9 cards"
- "Waiting for config" text -> changed to "Set your bets!"

---

## 8. Session 2 Changes (2026-04-05)

### Completed This Session
- **OT difficulty fix** — Overtime yard line reduced from 10 to 5 (3 downs, 9 cards, no FG)
- **"& Goal" fix** — Now shows whenever `yardLine <= 10`, not just when `hasFirstDown` is true
- **Retro 8-bit theme (Phase 1)** — Press Start 2P pixel font, retro color palette, sharp 2px corners, 4px pixel drop shadows on all panels/buttons, press-in button effect
- **Retro scoreboard** — Dark warm background with glowing yellow numbers (text-shadow) emulating old stadium bulbs
- **Instruction panel** — Orange background with white text for visibility
- **Label readability** — Grey labels brightened to #aab0cc with spacing added between labels and values
- **Config bar pulse** — Orange pulsing attention indicator on game start, stops when Set is clicked
- **Copyright notice** — Fixed bottom-right: "© 2025 Erick Delgado Rodriguez"
- **GitHub setup** — Repo created, deployed to GitHub Pages
- **Account rename** — drkroomstudio → delgado-plus (personal brand: Delgado+)
- **Copyright filed** — US Copyright Office: Literary Work (rulebook) + Computer Program (source code) both filed

### Git Tags
- `v1.0-singleplayer` — Stable 1P vs AI version with all above changes

---

## 9. Pending / Future Work

### Next Up: Online Multiplayer (Option B)
- **1v1 online multiplayer** — two devices, true hidden information
- WebRTC peer-to-peer or lightweight relay server
- Keep existing 1P vs AI mode as a selectable option
- Betting system designed for this — bluffing/reads only work with separate screens
- Tag `v1.0-singleplayer` preserves the stable AI version

### Still Pending
- **Unify pass/fold terminology** — both exist with same penalty. Likely just unify to "Pass"
- **Visual overhaul Phase 2** — football field layout improvements, real scoreboard look
- **Spectator betting** — future multiplayer feature
- **AI improvements** — more sophisticated card placement, bluffing behavior

---

## 10. Ownership & IP

- **Owner:** Erick Delgado Rodriguez (personal, NOT Dark Room Studio)
- **GitHub:** https://github.com/delgado-plus/ball-crap
- **Live URL:** https://delgado-plus.github.io/ball-crap/
- **Copyright:** US Copyright Office — Literary Work + Computer Program filed 2026-04-05
- **Brand:** Delgado+ (d+ for short)
- **NDA:** Beta tester NDA template in project folder (BallCrap_Copyright_and_NDA.rtf)

---

## 11. CSS Structure

- **Font:** Press Start 2P (Google Fonts import) — pixel/retro 8-bit theme
- **Color scheme:** Dark CRT navy (#0a0a1a), arcade gold (#ffcc00), NES green (#00cc44), retro orange (#ff8800)
- **Panels:** 2px borders, 2px border-radius, 4px solid black drop shadows
- **Scoreboard:** Dark warm bg (#1a1200), gold borders (#443300), glowing yellow scores with text-shadow
- **Buttons:** Pixel style with press-in effect (translate + shadow shrink on :active)
- **Config bar:** Pulsing orange attention animation (.config-bar--attention), disabled when locked
- Variables in `:root` (colors, sizes, fonts, animation durations)
- Sections: Reset, Layout, Scoreboard, Game Info, Field, Cards, Dice, Hand, Actions, Message Overlay, Result Display, Config Bar, Wallet Bar, Betting Panel, Bet Badges, Copyright
- Responsive: media queries at 400px and 768px
- Card flip animation via CSS transform + `card--flipped` class

---

## 12. HTML Structure

```
body
  button.restart-btn
  div.copyright ("© 2025 Erick Delgado Rodriguez")
  #app
    .config-bar (buy-in + balance inputs + Set button) [pulses orange on start]
    .wallet-bar (player credits | pot | AI credits)
    .scoreboard (player score | divider | AI score) [retro bulb style]
    .game-info (drive | down | yard line)
    .phase-instruction [orange bg, white text]
    .result-display
    .field
      .field__endzone
      .field__row--defense (CB1 | DB | CB2)
      .field__matchup-lines
      .field__row--offense (WR1 | RB | WR2)
    .dice-area
    .hand (label + cards)
    .betting-panel (title + positions)
    .actions (primary button)
  .message-overlay
```

---

## 13. Project Files

```
Ball_01/
  index.html                          — The game (single file, ~2470 lines)
  HANDOFF.md                          — This document
  BallCrap_Copyright_and_NDA.rtf      — Copyright filing checklist + Beta NDA
  BallCrap_Deposit_LiteraryWork_Rulebook.html    — Rulebook deposit (print to PDF)
  BallCrap_Deposit_ComputerProgram.html          — Source code deposit (print to PDF)
  serve.ps1                           — PowerShell HTTP server
  serve.bat                           — CMD wrapper for serve.ps1
  serve.sh                            — Bash wrapper (unused)
  .claude/launch.json                 — Preview server config (port 3001)
```
