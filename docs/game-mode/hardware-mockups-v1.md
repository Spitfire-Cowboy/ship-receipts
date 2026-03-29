# Hardware Mockups v1 (Seton)

Practical mockup pack for first-pass game mode hardware visuals.

## Trust posture (global rules)

- Local-first only. Show a visible **OFFLINE** badge in every frame.
- No cloud/sync/store/account/login/wallet UI.
- No pay-to-win language or purchasable boosts.
- Progress comes from local receipts, streaks, XP, and level only.

## Shared visual system

### Color palette

- `#0B1020` Midnight Navy — background
- `#151A2E` Deep Panel — cards
- `#1E2A4A` Steel Blue — secondary surfaces
- `#57E3A0` Mint Signal — power-up/success
- `#67B7FF` Electric Sky — level-up/XP milestones
- `#FFD166` Warm Amber — attention
- `#FF6B6B` Coral Alert — error/miss
- `#EAF2FF` Frost White — primary text
- `#AFC3E6` Mist Text — secondary text

### Typography spec

- **Display/labels:** `Press Start 2P` (pixel fallback allowed)
- **Body:** `Inter` (fallback `SF Pro Text`, `Arial`, sans-serif)
- **Sizes:** H1 28, H2 22, H3 18, body 14, caption 12
- **Usage:** all-caps for micro-labels; sentence case for body; 1.35 line-height

## 12-frame shot list

Status legend:
- **Power-up:** Mint glow/pulse + "SYSTEM READY"
- **Level-up:** Electric burst/ticks + "LEVEL +1"

### USB action figure (3)

#### 1) USB Hero Insert — Idle Boot
- **Purpose:** Introduce tactile USB collectible bridge.
- **Intended feeling:** Curiosity.
- **ASCII layout:**
```text
+--------------------------------------------------+
| [USB FIGURE]      SHIP RECEIPTS // OFFLINE [●]   |
|   (hero toy)         [PORT STATUS: CONNECTING]   |
| [LOCAL PROFILE]  Streak: 03   XP: 120            |
| [NO CLOUD] [NO STORE] [LOCAL SAVE]               |
+--------------------------------------------------+
```
- **Key UI elements:** USB callout, port status, streak/XP.
- **Status cues:** **Power-up** (mint pulse at connector).

#### 2) USB Syncless Handshake — Ready
- **Purpose:** Confirm recognition without network dependency.
- **Intended feeling:** Trust.
- **ASCII layout:**
```text
+--------------------------------------------------+
| OFFLINE [●]    DEVICE: HERO_FIG_01   LOCAL ONLY  |
| [HANDSHAKE OK ✓]                                 |
| Missions: 2 complete     Receipt hash: ######    |
| [START RUN]                                      |
+--------------------------------------------------+
```
- **Key UI elements:** device ID, handshake check, receipt hash.
- **Status cues:** **Power-up** (mint confirmation glow).

#### 3) USB Mission Complete — XP Burst
- **Purpose:** Show completed local run payoff.
- **Intended feeling:** Momentum.
- **ASCII layout:**
```text
+--------------------------------------------------+
| OFFLINE [●]                         LEVEL +1      |
| [MISSION COMPLETE]  +220 XP                      |
| Combo: x1.3       Streak: 04                      |
| [NEXT LOCAL MISSION]                             |
+--------------------------------------------------+
```
- **Key UI elements:** completion banner, XP gain, streak/combo.
- **Status cues:** **Level-up** (electric burst).

### Mini arcade phone-cab (3)

#### 4) Pocket Cabinet Attract Screen
- **Purpose:** Present nostalgic mini-cab shell around phone.
- **Intended feeling:** Playful confidence.
- **ASCII layout:**
```text
+---------------- MINI CAB ----------------+
| OFFLINE [●]      SHIP RECEIPTS ARCADE    |
|        [PRESS START]                     |
| Local Rank: Bronze   Streak: 05          |
| [NO ACCOUNT] [NO STORE]                  |
+------------------------------------------+
```
- **Key UI elements:** attract title, start CTA, local rank/streak.
- **Status cues:** **Power-up** (mint edge light).

#### 5) Run In Progress — Lane HUD
- **Purpose:** Validate compact gameplay HUD readability.
- **Intended feeling:** Focus.
- **ASCII layout:**
```text
+---------------- MINI CAB ----------------+
| OFFLINE [●]  TIME 01:42   MULTI x1.4     |
|  [lane visuals / tasks / receipts]       |
| HP: ████░   XP: ██████░░  GOAL 7/10       |
+------------------------------------------+
```
- **Key UI elements:** timer, multiplier, HP/XP bars, goal count.
- **Status cues:** **Power-up** (mint progress pulse).

#### 6) Stage Clear — Cabinet Flash
- **Purpose:** Show post-stage reward snapshot.
- **Intended feeling:** Triumph.
- **ASCII layout:**
```text
+---------------- MINI CAB ----------------+
| OFFLINE [●]          STAGE CLEAR!        |
| +180 XP   Accuracy 92%   Misses 1        |
| Streak +1  New Local Best                 |
| [CONTINUE]                               |
+------------------------------------------+
```
- **Key UI elements:** stage clear banner, stats, continue CTA.
- **Status cues:** **Level-up** (electric flash stripes).

### Apple IIe retro HUD (2)

#### 7) Retro Terminal Boot Overlay
- **Purpose:** Establish Apple IIe-inspired HUD tone.
- **Intended feeling:** Retro calm.
- **ASCII layout:**
```text
+================================================+
| OFFLINE [●]   SHIP_RECEIPTS_LOCAL v1           |
| BOOT OK                                         |
| > load run --today                              |
| > streak: 06   xp: 940   level: 03              |
| > status: READY                                 |
+================================================+
```
- **Key UI elements:** terminal commands, local status lines.
- **Status cues:** **Power-up** (mint scanline sweep).

#### 8) Retro Progress Tick + Promotion
- **Purpose:** Show terminal-style level promotion.
- **Intended feeling:** Earned advancement.
- **ASCII layout:**
```text
+================================================+
| OFFLINE [●]   RUN RESULT                        |
| tasks_done=9/9                                  |
| streak=07                                       |
| xp_total=1120                                   |
| >>> LEVEL +1 (03 -> 04)                         |
+================================================+
```
- **Key UI elements:** deterministic stats, promotion line.
- **Status cues:** **Level-up** (electric cursor burst).

### Transition strips (4)

#### 9) USB -> Mini Cab Transition Strip
- **Purpose:** Bridge collectible mode to arcade mode.
- **Intended feeling:** Seamless shift.
- **ASCII layout:**
```text
[USB FIG]=====>=====[PHONE CAB]
 OFFLINE [●]   LOCAL MODE TRANSFER   OFFLINE [●]
```
- **Key UI elements:** directional strip, dual offline badges.
- **Status cues:** **Power-up** (traveling mint highlight).

#### 10) Mini Cab -> Apple IIe Transition Strip
- **Purpose:** Bridge action HUD to analytical terminal.
- **Intended feeling:** Clarity.
- **ASCII layout:**
```text
[ARCADE HUD]=====>=====[RETRO TERMINAL]
 OFFLINE [●]   SESSION SUMMARY PIPELINE   OFFLINE [●]
```
- **Key UI elements:** mode icons, summary transfer label.
- **Status cues:** **Power-up** (mint data-stream dashes).

#### 11) Power-up Status Strip
- **Purpose:** Reusable readiness overlay.
- **Intended feeling:** Charge-up.
- **ASCII layout:**
```text
+----------------------------------------------+
| OFFLINE [●]   SYSTEM READY   POWER-UP ACTIVE |
+----------------------------------------------+
```
- **Key UI elements:** offline badge, readiness text.
- **Status cues:** **Power-up** only (mint pulse/ring).

#### 12) Level-up Status Strip
- **Purpose:** Reusable milestone overlay.
- **Intended feeling:** Achievement.
- **ASCII layout:**
```text
+----------------------------------------------+
| OFFLINE [●]   LEVEL +1   XP THRESHOLD MET    |
+----------------------------------------------+
```
- **Key UI elements:** level text, threshold tag.
- **Status cues:** **Level-up** only (electric burst/ticks).

## Image generation prompts (10)

**Shared style prefix (prepend to each):**
`Retro-futurist game UI mockup, pixel-arcade influence, clean composition, high-legibility HUD, practical product design render, midnight navy palette with mint/electric accents, visible OFFLINE badge, local-first UX, no cloud/sync/store/account UI, no pay-to-win messaging.`

1. `USB action figure insert scene, port status CONNECTING, streak and XP visible, mint pulse around connector.`
2. `USB handshake-ready scene with DEVICE HERO_FIG_01 chip, handshake checkmark, local receipt hash snippet.`
3. `USB mission-complete scene with +220 XP, combo and streak chips, electric level-up burst.`
4. `Mini arcade phone-cab attract screen with PRESS START, local rank and streak, mint edge lighting.`
5. `Mini cab gameplay HUD with timer, multiplier, HP/XP bars, goal progress 7/10, compact readable layout.`
6. `Mini cab STAGE CLEAR frame with accuracy and misses stats, continue button, electric flash stripes.`
7. `Apple IIe-inspired boot HUD with monospaced command lines, BOOT OK, READY status, subtle scanlines.`
8. `Apple IIe run-result frame with deterministic stats and LEVEL +1 promotion line, electric cursor burst.`
9. `Horizontal transition strip: USB icon morphing to mini-cab icon, moving mint highlight, dual OFFLINE badges.`
10. `Two status strips side-by-side: SYSTEM READY POWER-UP ACTIVE (mint) and LEVEL +1 XP THRESHOLD MET (electric).`

## 10-point review checklist

1. 12 frames present and grouped 3/3/2/4.
2. Every frame includes title, purpose, feeling, ASCII, key UI, status cue.
3. OFFLINE badge visible in every frame.
4. No cloud/sync/store/account/login UI.
5. No pay-to-win language.
6. Power-up vs level-up cues are distinct (mint vs electric).
7. Local streak/XP/level progression is clear.
8. Palette usage is consistent.
9. Typography follows spec.
10. All prompts are copy-paste ready with shared prefix.
