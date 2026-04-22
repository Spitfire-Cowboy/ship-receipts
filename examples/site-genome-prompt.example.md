# Site Genome Prompt Example

```text
SYSTEM:
You are recreating a shipped project from a genome prompt. Follow constraints exactly.

GENOME VERSION: 1
PROJECT: spitfirecowboy.com
FIDELITY: L2

[Product intent]
- Build a personal studio site that feels direct, practical, and proof-oriented.
- Primary user: founder/operator deciding whether to trust the builder.
- Success criteria:
  - user can understand what is shipped in under 60 seconds
  - user can navigate proof links quickly
  - mobile and desktop are both first-class

[Hard constraints]
- Framework: Next.js 14, TypeScript, npm
- Runtime: Node >= 20
- Accessibility: keyboard navigation across all nav items and CTAs
- Performance target: Lighthouse performance >= 90 on main landing route
- Non-goals:
  - no CMS
  - no auth
  - no marketplace flows

[Information architecture]
- Routes:
  - `/` landing + value proposition + latest shipped work
  - `/work` project index with cards
  - `/patterns` operating patterns
  - `/contact` plain contact options
- Core user flow:
  - land on `/`
  - inspect one project proof chain
  - jump to external artifact (repo/demo)

[Design system essentials]
- Typography:
  - headings: "Space Grotesk", sans-serif
  - body: "IBM Plex Sans", sans-serif
- Color tokens:
  - bg: #0B1020
  - surface: #111831
  - text: #E8ECFF
  - accent: #3BC9B2
  - accent-2: #F59E0B
- Radius: 12px for cards, 9999px for pills
- Motion:
  - page sections reveal with 120ms stagger
  - hover transitions <= 180ms

[Component map]
- Header with sticky nav
- Hero block with short value proposition and 2 CTAs
- Project card grid with proof links
- Pattern list section
- Footer with minimal links
- Required states:
  - loading skeleton for project list
  - empty project list state

[Data contract]
- Local JSON data file:
  - projects[]: { slug, name, summary, repo_url, demo_url, receipt_url }
  - patterns[]: { slug, title, thesis }

[Build and run instructions]
- `npm install`
- `npm run build`
- `npm run test`
- `npm run dev`

[Verification instructions]
- Confirm route parity: `/`, `/work`, `/patterns`, `/contact`
- Confirm project cards render proof links
- Confirm keyboard focus order in header nav
- Compare generated output to shipped repo and report:
  - equivalent areas
  - known acceptable deltas (copy phrasing, spacing micro-adjustments)

[Human delta notes]
- Final shipped version used tighter copy and adjusted spacing scale from 8px grid to 6px grid in hero.
- Added one extra social proof row after user testing.
```
