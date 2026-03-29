# Kenney Asset Mapping v1

**Status:** DRAFT
**Date:** 2026-02-26
**Author:** Seton (Claude Cowork)
**Source:** `assets/kenney/all-in-one/` (gitignored, local only)

---

## Overview

Map Kenney Game Assets All-in-1 v3.4.0 packs to ship-receipts game mode components. Assets are local development aids — they are not distributed with the repo.

---

## Pack → Component Mapping

### UI Pack (`UI assets/UI Pack/`)

Primary UI framework for all game mode screens.

| Asset Category | Use In Game Mode |
|----------------|-----------------|
| Buttons (blue, green, red, yellow) | Action buttons: Score, Export, Submit, Add to Party |
| Panels (beige, blue, gray) | Receipt cards, score breakdowns, party member cards |
| Bars (horizontal) | Streak progress bars, verification depth bars |
| Checkboxes/radios | Proof breakdown checklist (✓/─ indicators) |
| Arrows | Navigation, state machine flow indicators |
| Icons (gear, star, trophy) | Settings, stars count, achievement indicators |

### Game Icons (`Icons/Game Icons/`)

Status indicators and proof element markers.

| Icon | Game Mode Use |
|------|-------------|
| `checkmark.png` | Proof element present in breakdown |
| `cross.png` | Proof element absent / validation failed |
| `exclamation.png` | Warning (duplicate submission, streak at risk) |
| `star.png` | Stars signal in receipt |
| `trophy.png` | Streak milestone achieved |
| `locked.png` | Next multiplier tier (not yet reached) |
| `unlocked.png` | Current multiplier tier (achieved) |
| `gear.png` | Settings |
| `information.png` | Help/info tooltip |
| `medal*.png` | Character class indicators (ROOKIE → LEGENDARY) |
| `shield.png` | Integrity badge (gold shield for verified integrity) |

### Game Icons Expansion (`Icons/Game Icons Expansion/`)

Extended icon set for detailed states.

| Icon | Game Mode Use |
|------|-------------|
| `fire.png` | Streak indicator (🔥) |
| `sword.png` | VETERAN class icon |
| `wizard.png` / `wand.png` | LEGENDARY class icon |
| `hammer.png` | BUILDER class icon |
| `wrench.png` | BUILD / construction metaphor |
| `scroll.png` | Receipt document icon |
| `chest.png` | Score total / treasure metaphor |
| `potion.png` | Multiplier bonus active |
| `crown.png` | #1 rank in party leaderboard |
| `flag.png` | Streak start / milestone marker |

### Board Game Icons (`Icons/Board Game Icons/`)

Party mode and social features.

| Icon | Game Mode Use |
|------|-------------|
| Character tokens | Party member avatars (fallback when no GH avatar) |
| Dice | Could represent scoring variability (future use) |
| Cards | Receipt cards in party view |

### UI Pack - Sci-fi (`UI assets/UI Pack - Sci-fi/`)

Alternative theme for "proofofship mode" — distinguish global from local visually.

| Asset Category | Use In Game Mode |
|----------------|-----------------|
| Panels (dark, metallic) | Global/verification screens |
| Buttons (neon accents) | Submit, Verify actions |
| Progress bars | Verification pipeline progress |

### UI Pack - Adventure (`UI assets/UI Pack - Adventure/`)

Alternative theme for party mode — RPG character sheet feel.

| Asset Category | Use In Game Mode |
|----------------|-----------------|
| Panels (parchment style) | Character cards, party roster |
| Frames | Avatar frames by class tier |
| Banners | Streak milestone banners |
| Ribbons | Badge ribbons for status |

---

## Badge → Asset Mapping

| Badge | Color | Kenney Asset Source |
|-------|-------|-------------------|
| DRAFT | Gray | `UI Pack/PNG/gray_button*.png` |
| VALID | Blue | `UI Pack/PNG/blue_button*.png` |
| SCORED | Green | `UI Pack/PNG/green_button*.png` |
| EXPORTED | Purple | Custom tint on `UI Pack` base (purple not in default set) |
| PENDING | Yellow | `UI Pack/PNG/yellow_button*.png` |
| ACCEPTED | Green | `UI Pack/PNG/green_button*.png` + checkmark overlay |
| REJECTED | Red | `UI Pack/PNG/red_button*.png` + cross overlay |
| VERIFIED | Gold | `UI Pack/PNG/yellow_button*.png` + star overlay |

---

## Character Class → Asset Mapping

| Class | Icon Source | Frame Source |
|-------|-----------|-------------|
| ROOKIE 🌱 | `Game Icons/sprout.png` or `seedling` | `UI Pack - Adventure/` basic frame |
| BUILDER 🔨 | `Game Icons Expansion/hammer.png` | `UI Pack - Adventure/` bronze frame |
| ARCHITECT 🏗️ | `Game Icons Expansion/wrench.png` | `UI Pack - Adventure/` silver frame |
| VETERAN ⚔️ | `Game Icons Expansion/sword.png` | `UI Pack - Adventure/` gold frame |
| LEGENDARY 🧙 | `Game Icons Expansion/wand.png` or `crown.png` | `UI Pack - Adventure/` ornate frame |

---

## Screen → Primary Pack

| Screen | Primary Pack | Secondary Pack |
|--------|-------------|----------------|
| Dashboard | UI Pack | Game Icons |
| Receipt Detail | UI Pack | Game Icons |
| Streak View | UI Pack | Game Icons Expansion |
| Party Roster | UI Pack - Adventure | Board Game Icons |
| Verification Progress | UI Pack - Sci-fi | Game Icons |
| Scoreboard (global) | UI Pack - Sci-fi | Game Icons Expansion |

---

## Audio (`Audio/`)

| Sound | Trigger |
|-------|---------|
| `coin.wav` / `pickup` | Points awarded (score computed) |
| `powerUp.wav` | Multiplier tier unlocked |
| `achievement.wav` | Streak milestone reached |
| `confirm.wav` | Receipt validated / exported |
| `error.wav` | Validation failed |
| `levelUp.wav` | First verified receipt (global) |

---

## Asset Integration Notes

1. **All Kenney assets are gitignored.** They live in `assets/kenney/` locally. The game mode code references them by conventional path; if assets are missing, fall back to text/emoji rendering.
2. **PNG preferred.** Use 2x PNG versions for retina/high-DPI. Vector (SVG) available as backup.
3. **No custom art in v1.** Everything must map to an existing Kenney asset or degrade to text.
4. **Purple badge:** Kenney's UI Pack doesn't include purple buttons natively. Options: tint the gray button purple in code, or use Sci-fi pack's accent colors.
5. **Spritesheets available** for all packs if performance matters (web rendering).
