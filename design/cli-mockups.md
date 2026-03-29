# Design Ideas & Inspiration

## What this demo should show

Walk through a daily session of using ship-receipts — a CLI game where you create verifiable receipts for work you've shipped. See pitch.md for the full concept.

The daily loop: declare a goal → do work → create a receipt → score it → get a compass reflection from an LLM → track your streak. It's the hero's journey in microcosm.

## Visual inspiration

**BBS door games** — Trade Wars 2002, Legend of the Red Dragon, Land of Devastation. These were text-based multiplayer games played over modems. They used ANSI color, box-drawing characters, and ASCII art to create atmosphere within terminal constraints. They felt alive despite being pure text. Single-key commands, status bars always visible, session-based play.

**Claude Code's terminal UI** — persistent status bar, Unicode block characters for progress, color-coded thresholds (green/yellow/red), streaming output that feels alive. Much more visually interesting than typical CLI tools.

**The Odyssey** — John Flaxman's 1793 line drawings of the Odyssey (public domain, CC0 via the Met) are pure outline art that could convert beautifully to ASCII/terminal art. The game's narrative framing is the Odyssey — you declare your own Ithaca and sail toward it.

**Kenney audio** — optional sound effects. Confirmation chime on score, glass shatter on streak break, retro chiptune jingle on milestone. CC0.

## What makes this different from a normal CLI tool

It's a game. It should feel like a game. The scoring should feel satisfying. The streak should create tension. The compass reflection should feel like a wise friend. The terminal should feel alive, not like a log dump.

## Reference file

gt-demo-reference.html is a Golden Thread demo built in this same style (browser-framed interactive walkthrough). Use the same single-file HTML approach but frame it as a terminal window instead of a browser window.

## Key scenes to include

1. Welcome/title
2. Declaring your Ithaca (goal)
3. Creating a receipt (init)
4. Scoring it (the satisfying part)
5. LLM compass reflection
6. Streak/voyage view
7. Exporting to the MMO (proofofship)
