# Hardware Bridge Display Concept v1

**Status:** DRAFT
**Date:** 2026-02-26
**Author:** Seton (Claude Cowork)
**Scope:** Docs-only concept. No code changes.

---

## Purpose

Physical feedback for game-mode progress. When you ship something real, something real should happen on your desk. A light flashes, a figure reacts, a tiny screen updates your streak. This doc captures two hardware concepts that sit alongside the local game loop, not replace it.

---

## Two Concepts

### 1. USB Action-Figure Feedback Device

A small USB-connected device (Arduino/ESP32) that reacts to game events. Think Medieval Madness energy: a physical topper that lights up, vibrates, or moves when you hit milestones.

**What it does:**
- LED flash on receipt validation
- Vibration motor pulse on streak milestones (3x, 7x, 30x)
- Servo nudge on level-up (figure does a little bow or fist-pump)
- Ambient glow color maps to current tier/rank

**Parts:** Arduino Nano or ESP32, a few LEDs, a micro servo, a vibration motor, and whatever action figure or 3D-printed topper you like.

### 2. Mini Arcade-Style Display

A tiny dedicated screen showing your game-mode dashboard. Could be an old phone in landscape, a cheap SPI display on a Pi Zero, or a repurposed e-ink badge.

**What it shows:**
- Current streak count and streak flame animation
- Last receipt summary (one-liner)
- XP bar and level
- Party roster (tiny character sprites)
- Next milestone countdown

**Parts:** Raspberry Pi Zero W (or old Android phone), small IPS/e-ink display, 3D-printed or cardboard stand.

---

## Cost Tiers

| Tier | Budget | Action-Figure Device | Mini Display |
|------|--------|----------------------|--------------|
| Ultra-budget | < $15 | Arduino Nano clone + 3 LEDs + cardboard housing | Old phone you already own + free dashboard app |
| Balanced | $25-$40 | ESP32 + NeoPixel ring + micro servo + 3D-printed base | Pi Zero W + 2" IPS display + printed stand |
| Nicer | $50-$80 | ESP32-S3 + LED matrix + servo + custom 3D enclosure | Pi Zero 2W + 3.5" IPS + e-ink sidebar + wood stand |

All tiers assume you already have a USB cable and access to a computer.

---

## DIY-First Principle

Everything here is designed to be built from off-the-shelf parts. No custom PCBs, no proprietary firmware, no vendor lock-in.

- **Off-the-shelf first.** Every component should be available on Amazon, AliExpress, or Adafruit.
- **Optional 3D print.** Enclosures and stands can be 3D-printed, but cardboard or laser-cut works too. STL files will live in `assets/hardware/` when they exist.
- **Simple serial protocol.** The bridge device reads JSON lines over USB serial. The game loop emits events; the device consumes them. No drivers, no SDK, no pairing flow.

---

## Hard Constraints

1. **Offline by default.** The device never needs internet. It reads events from the local game loop over USB or local network. No cloud, no account, no phone-home.
2. **No phoning home.** Zero telemetry. The device firmware and display app ship with no analytics, no update pings, no DNS lookups. If you airgap it, it still works.
3. **No pay-to-win.** Hardware is cosmetic and informational only. Owning a bridge device gives you zero scoring advantage. No exclusive power-ups, no gated content, no premium tiers.

---

## Power-Ups vs Level-Up Moments

The game loop already defines power-ups (temporary boosts) and level-ups (permanent progression). The hardware bridge maps to these differently:

| Game Event | Power-Up (temporary) | Level-Up (permanent) |
|------------|----------------------|----------------------|
| Action-figure device | Quick LED flash + vibration burst | Servo movement + color shift to new tier |
| Mini display | Animated overlay (2-3 sec) | Dashboard layout change, new badge icon |
| Feedback duration | 1-3 seconds | 5-10 seconds, stays visible |

**Key rule:** Power-ups are punchy and brief. Level-ups are dramatic and persist visually until the next session.

---

## Parked for Later: Hardware Aesthetics

These ideas are interesting but will derail shipping if we chase them now. Parking here so they don't get lost:

- Retro CRT filter shader on the mini display
- E-ink "receipt printer" that prints a physical receipt stub on milestone
- NFC tap-to-export: tap phone to bridge device to trigger proof export
- Custom keycap with embedded LED that glows based on streak
- Sound effects module (chiptune level-up jingle)
- Multi-device sync for team/party mode (LAN discovery)

**Do not start these until the core game loop ships and v1 hardware bridge is validated with at least 3 testers.**

---

## Next Steps: First 3 Prototype Tasks

These are future-lane items. They don't block any current work.

1. **Serial event spec.** Define the JSON-lines schema for game events over USB serial. Minimum viable: `{"event": "receipt_validated", "streak": 5, "xp": 120}`. Add to `schemas/` when ready.
2. **Arduino blink sketch.** A <50-line Arduino sketch that reads serial JSON and blinks an LED on `receipt_validated`. Proves the bridge concept end-to-end. Target: works in 15 minutes from clone.
3. **Old-phone dashboard.** A single-file HTML page that connects to `localhost` via WebSocket and renders streak + XP. Deploy by opening the file on any phone browser pointed at the dev machine.

---

*This doc is concept-only. No code, no firmware, no hardware purchases until the core game loop is shipping.*
