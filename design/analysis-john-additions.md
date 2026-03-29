# Analysis: John's Additions to ship-receipts / proofofship
## March 2026

---

## 1. Human + N Personas (RPG Party)

**The idea:** A single human registers, then creates N personas underneath them. The persona count maps to their paid tier. The "posse" functions like an RPG party.

**Why this is strong:**

The Odyssey metaphor already implies a crew. Extending that to actual persona slots makes the game layer feel real rather than decorative. Each persona could have a distinct identity — maybe one tracks your open-source work, another your day-job commits, another your side project. You're not just one sailor, you're running a fleet.

**Tier structure suggestion:**

- Free: 1 persona (solo voyage)
- Pro ($X/mo): 3 personas (small crew)
- Team ($Y/mo): 5+ personas (full party)

**RPG class angle:** Each persona could have a specialty that maps to actual dev workflows — "Navigator" (architecture/planning work), "Shipwright" (building/coding), "Lookout" (code review/QA), "Cartographer" (documentation). Different work types earn different XP bonuses based on class. This gives people a reason to think about *what kind* of work they're doing, not just *how much*.

**Risk:** Complexity. Personas need to be dead simple to create and switch between, or nobody will bother. The Claude CLI model is good here — one config file, one command to switch context.

---

## 2. Org Signup: N Humans, N^N Agents

**The idea:** Organizations sign up with N human seats, each human can have N agents (giving N^N total agent capacity).

**Why this matters:**

This is the enterprise play. Individual devs use ship-receipts for personal motivation. Orgs use it for visibility into what's actually shipping across teams — without the surveillance-tool feel, because it's framed as a game. That's a meaningful differentiator from tools like LinearB, Jellyfish, etc. which feel like management panopticons. ship-receipts says "prove what you shipped" rather than "we're watching what you do."

**The N^N model is interesting but might be overkill initially.** A simpler model: Org gets N human seats, each human gets their standard tier personas. Agents (CI bots, deploy hooks, etc.) could be a separate pool — maybe 2-3x the human count. The exponential model sounds cool but could create pricing confusion.

**Org-level features to consider:**

- Fleet view: see all crew members' voyages on one dashboard
- Shared Ithaca goals: team-level objectives that individual waypoints contribute to
- Leaderboards (opt-in): friendly competition without toxicity
- Org-wide streak: "the fleet sailed for 30 consecutive days"

---

## 3. DOOR Game Licensing + Game Designer Ecosystem

**The idea:** License existing BBS door games. Let game designers sell (or give away) their own game modes. Don't build content — be the platform.

**This is the most interesting idea because it reframes what ship-receipts is.**

Right now it's a product. With a game mode ecosystem, it becomes a *platform*. The Three Kingdoms mode is already a proof of concept — someone who knows Chinese military history and game design could build that better than a generalist team ever could.

### On licensing existing DOOR games:

The nostalgia angle is real. Legend of the Red Dragon, Trade Wars 2002, Usurper — these have cult followings. Some creators are still active. The risk is that these games were designed for multi-user BBS systems with persistent state, not single-player CLI sessions. You'd need to adapt them significantly.

**Better approach:** Don't license the games themselves. License the *aesthetic* and *mechanics*. "Inspired by Trade Wars 2002" is cheaper and more flexible than a full license. Or just build original modes that channel the same energy.

### On the marketplace question:

Your latest thinking is sharper: "Allow game devs to just sell game modes themselves? I don't even need a marketplace."

**This is correct.** You don't need to be the App Store. You need to be the *runtime*. Define the game mode API/format, publish it, and let devs distribute however they want — their own sites, itch.io, GitHub, wherever. Your role is:

1. Define the spec (what a game mode is, how it hooks into ship-receipts)
2. Provide the runtime (ship-receipts CLI loads and runs game modes)
3. Optionally provide a directory (not a store — just a listing)
4. Charge for the platform subscription, not per-game-mode

**Free vs. paid game modes:** Let the creators decide. You don't need to take a cut. Your revenue comes from proofofship.com subscriptions. If game modes make the platform stickier, that's more subscribers. Taking a cut of game sales adds complexity (payment processing, refunds, disputes, tax) for minimal revenue. If you feel you need to moderate, charge a one-time listing fee rather than a percentage.

### Why "no marketplace" might be the right call:

- Zero platform tax = attracts more creators
- No payment infrastructure to build/maintain
- No moderation burden (creators host and sell their own stuff)
- You just maintain the spec and the runtime
- Creators link to their modes from the proofofship.com directory (optional)

This is closer to the Minecraft mod ecosystem than the iOS App Store. And Minecraft mods built one of the most engaged gaming communities in history without Mojang taking a cut.

---

## Revenue Model Summary

Based on these additions, the business model crystallizes:

**proofofship.com subscriptions** are the core revenue:

- Free tier: 1 persona, basic Odyssey mode, community game modes
- Pro tier: 3+ personas, all official game modes, priority fleet sync
- Org tier: N seats, fleet dashboard, shared Ithaca goals, agent slots

**Game modes are the flywheel**, not the revenue:

- More game modes → more reasons to subscribe → more subscribers
- More subscribers → more players for game designers to build for → more game modes
- You never need to build content again after the initial modes ship

**What you DON'T charge for:**

- Game mode listing/distribution
- Game mode development tools/SDK
- Basic ship-receipts CLI (free forever — this is the growth engine)

---

## Open Questions

1. **Persona switching UX:** How seamless does this need to be? Can you be "playing" multiple personas simultaneously (one per repo?) or do you explicitly switch?

2. **Agent identity:** When a CI bot ships a deploy, whose voyage does it count toward? The human who triggered it? The org fleet? A dedicated "bot persona"?

3. **Game mode sandboxing:** If third-party game modes run in the CLI, what's the security model? Probably needs to be declarative (JSON/YAML game definitions) rather than executable (arbitrary code).

4. **Cross-mode progression:** If someone plays Odyssey mode and Three Kingdoms mode, do they share XP? Streaks? Or are they separate voyages?

5. **Offline/local-first:** ship-receipts should work without an internet connection. Game modes need to work locally too. The proofofship.com sync should be eventual, not required.

---

*Analysis prepared alongside the daily-odyssey.html demo, March 2026.*
*github.com/pro777*
