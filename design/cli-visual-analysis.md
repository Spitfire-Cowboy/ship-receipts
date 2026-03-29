# CLI Visual Capabilities Analysis

## ship-receipts Terminal Rendering Options

### 1. Pure ASCII Art (Baseline)

- 16 ANSI colors (8 standard + 8 bright)
- Box-drawing characters: `│ ─ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼`
- Block elements: `█ ▓ ▒ ░`
- Works in every terminal since the 1980s

### 2. Unicode Half-Block Pixel Art

- Characters: `▀ ▄ █` (upper half, lower half, full block)
- Each character cell = 2 vertical pixels (foreground + background color)
- Effective resolution: ~160×100 in a standard 80-col terminal
- True color (24-bit) support via `\e[38;2;R;G;Bm` / `\e[48;2;R;G;Bm`
- **Best balance of compatibility and visual quality**
- Works in: iTerm2, kitty, Alacritty, Windows Terminal, most modern terminals

### 3. Braille Character Pixel Art

- Unicode Braille range: U+2800–U+28FF (⠁ through ⣿)
- Each character = 2×4 dot grid (8 subpixels)
- Effective resolution: ~160×200 in 80-col terminal
- Best for line art, graphs, diagrams
- Monochrome per character cell (one fg color)
- Works anywhere with Unicode support

### 4. Sixel Graphics

- Actual pixel-level rendering in terminal
- Supported by: xterm (with `-ti vt340`), mlterm, foot, WezTerm
- NOT supported in: iTerm2, kitty, Alacritty
- Protocol sends bitmap data inline in the text stream
- Full color palette (up to 256 or more colors per image)
- `libsixel` library for encoding

### 5. Kitty Graphics Protocol

- GPU-accelerated image rendering
- Supports: PNG, animation, z-layering
- Only works in kitty terminal
- Images transmitted as base64-encoded data
- Can overlay text on images

### 6. iTerm2 Inline Images

- Proprietary protocol using OSC escape sequences
- Supports PNG, JPEG, GIF
- Works in iTerm2, WezTerm, mintty
- Base64-encoded image data in escape sequence

---

## Recommended Approach for ship-receipts

### Hybrid Strategy

1. **Primary UI**: Unicode box-drawing + ANSI colors (universal)
2. **Accent art**: Half-block pixel art for logos, icons, ship imagery
3. **Graphs/progress**: Braille characters for XP curves, streak charts
4. **Optional**: Detect terminal capabilities and upgrade to Sixel/Kitty when available

### Why Not Full Pixel Art (Legend of Kyrandia style)?

- Fragmented terminal support (Sixel vs Kitty vs iTerm2)
- Most developers use terminals that support half-blocks but not Sixel
- Half-block art at 160×100 is enough for atmospheric pixel art headers
- The BBS door game aesthetic actually benefits from text-mode constraints

### Practical Resolution Math

```text
Standard 80×24 terminal:
  - Text mode:      80 × 24 characters
  - Half-blocks:   160 × 48 pixels (at 80×24)
  - Braille:       160 × 96 pixels (at 80×24)
  - Full screen:   160 × 100+ pixels (half-blocks, 80×50+)

VGA 320×200 (Kyrandia):
  - Need ~160 cols × 100 rows of half-blocks
  - That's a 160-col terminal with 100 rows visible
  - Achievable in a maximized modern terminal window
```

### Inspiration Sources

- **starship.rs**: Nerd Font glyphs for icons (git branch , folder , etc.)
- **Nerd Fonts**: 3,600+ patched icons available in terminal
- **Gruvbox Rainbow**: Warm palette (orange #fe8019, yellow #fabd2f, aqua #8ec07c, purple #d3869b on dark #282828)
- **btop/htop**: TUI layout with panels, graphs, status bars
- **lazygit**: Interactive menu navigation in terminal
