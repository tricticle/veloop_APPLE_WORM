# APPLE WORM ADVENTURE

A browser puzzle game about collecting apples, growing a worm, and finding a safe route to the portal. The initial implementation includes a playable 50-level catalog, account-backed progress, server-validated movement, an opt-in public leaderboard, and a capped first-clear coin economy.

## Reference and originality

The supplied reference is **Snake Puzzle: Slither to Eat**. This implementation follows the brief's decision to proceed from the written description; the Android app was not installed or played in this environment. The game identity, worm design, board presentation, level data, controls, and synthesized audio are original to this project. No reference-game assets or layouts are used.

## Stack choice

- Next.js App Router, React, TypeScript, and Tailwind CSS
- Neon Postgres with Drizzle ORM
- Better Auth with email and password
- Server Actions for authenticated game sessions and mutations

This stack is allowed by the assignment and fits the Vercel workspace. PostgreSQL transactions are useful for atomically saving verified run results, the player's balance, and the wallet/reward ledger; Neon is already connected to this project. Better Auth owns password hashing and session cookies, so the application does not store plaintext passwords or implement a client-only login gate.

## Gameplay

- Arrow keys, WASD, direction buttons, board tile clicks, and mobile swipes move the worm one tile.
- **Dual-path level design (50 trails)**:
  - Levels 1–20 are individually handcrafted layouts (`lib/game/levels-handcrafted.ts`), and Levels 21–50 span 12 distinct 7x7 and 8x8 mechanic archetypes (`lib/game/levels.ts`) with no shared route-template clones.
  - Every level has an **optimal 3★ route** (`optimalSolution`) and a longer or bonus-skipping **safe 1★ route** (`fallbackSolution`).
  - Stars are scored dynamically from the completed run (`calculateStars(level, state)` on both client and server) against `starThresholds`: **3★** requires beating par moves and collecting required golden apples, **2★** rewards routes faster than fallback or collecting bonus golden apples on a longer run, and **1★** clears safely.
- **7 deterministic mechanics**:
  1. **Keys & color-matched gates**: Collect amber (`k`/`K`) or emerald (`q`/`Q`) keys to unlock matching gates (`keyId` + `color`).
  2. **Paired warp stones**: Step onto pad `1`/`2` (`warp-1`) or `3`/`4` (`warp-2`) to teleport across the board with tail-clearance safety checks.
  3. **Frost slide tiles (`I`)**: Slide deterministically in your movement direction until hitting a wall, locked gate, border, or non-ice tile while collecting apples along the slide.
  4. **Fragile planks (`F`)**: Crack when stepped on and collapse into impassable hollows once the worm's tail vacates the tile.
  5. **Timed pulsing brambles (`%`) & swooping hawks (`moving`)**: Deterministic turn-parity spikes (`period` / `activeOffset`) and patrol-path birds.
  6. **Bird rescue (`R`)**: Free trapped songbirds to unlock the exit portal on `BIRD_RESCUE` trails.
  7. **Optional golden apples (`G`) & streak combos**: Optional to clear the level, required for 3★ perfection, with rising-pitch streak popups.
- **Companion & Post-Clear Review**: Pip the Robin reacts to moves, streaks, rescues, and close calls. After clearing any trail, toggle **Compare 3★ path** to inspect your route against the 3★ trail directly on the board. Hints default to the 3★ shortcut and can be switched to the safer 1★ route in Settings.

## Authoring and validating a dual-path level

Add new entries to `HANDCRAFTED_LEVELS` in `lib/game/levels-handcrafted.ts` (or extend `buildLevelFromSpec` specs in `lib/game/levels.ts`):

1. Define an ASCII `rows` grid using `.` walkable, `#` wall, `H` head, `B` body (or explicit `wormStart`), `P` portal, `A` apple, `G` golden apple, `^` spike, `%` timed spike, `o` burrow pit, `=` apple-locked gate, `k`/`K` amber key/gate, `q`/`Q` emerald key/gate, `I` frost slide, `F` fragile plank, `R` trapped bird, and `1`/`2` or `3`/`4` teleport pairs.
2. Provide both `optimalSolution: Direction[]` (collecting all golden apples within `optimalMoves`) and `fallbackSolution: Direction[]` (valid clear that is strictly longer or skips bonus golden apples).
3. Run unit & module-load validation (`tests/game.test.ts` and `validateLevelDualPaths`) — module load automatically throws if either path fails to win, fails to earn its target star tier, or if `optimalSolution` is not strictly better than `fallbackSolution`.

## Architecture

- `src/config/gameConfig.ts` is the single game-name source. `VITE_GAME_NAME` takes precedence for the assignment's rename test, then `GAME_NAME`, then the default.
- `lib/game/types.ts` defines shared pure TypeScript types (`GameLevel`, `GameState`, `StarThresholds`, `PlayerSettings`, etc.).
- `lib/game/levels-handcrafted.ts` and `lib/game/levels.ts` define all 50 dual-path levels and validate every `optimalSolution` and `fallbackSolution` at module load.
- `lib/game/engine.ts` is the shared deterministic movement, collision, ice-slide, fragile-plank, key/gate, teleport, rescue, star calculation, and dual-mode hint logic used by both browser play and server validation.
- `components/game/` contains the redesigned SVG worm & board (`game-board.tsx`), animated companion (`bird-companion.tsx`), controls, level selector with chapter star tallies, rewards, achievements, leaderboard, and settings views.
- `lib/db/schema.ts`, `lib/db/index.ts`, and `drizzle/0001_dual_path_and_mechanics.sql` manage the Neon schema with idempotent additive column upgrades (`ensureExtendedSchema()`).
- `app/actions/game.ts` scopes sessions and profile reads/writes by the authenticated user. Each move is replayed by the server and stars are recomputed server-side from the replayed `GameState`.
- `services/ads/ad-provider-adapter.ts` is the provider boundary. It currently reports `AD_UNAVAILABLE` rather than simulating an ad.

## Account and progression data

The Neon database contains Better Auth's `user`, `session`, `account`, and `verification` tables, plus:

- `game_profiles` — current level, aggregate score/stars, wallet, apple totals, `noUndoClears`, `birdsRescued`, and preferences (`safeHint`, `hapticsEnabled`)
- `level_progress` — best score, best move count, stars, `bestRouteType`, `noUndoClear`, and first completion per user/level
- `game_sessions` — server-owned move state, undo history, `usedUndo`, `starsEarned`, checkpoint, and run status
- `wallet_transactions` — append-only balance changes with before/after balances
- `reward_transactions` — reward type, amount, source, status, and unique provider event ID
- `ad_opportunities` — placement, eligibility window, and lifecycle status
- `economy_configs` — server-controlled reward values and caps

Every player-owned query is scoped by the Better Auth session user ID. Guests can play, but their progress is in memory only and is not presented as saved.

## Economy design

A first completion of a level grants the server-configured `levelCompletionCoins` amount (currently 25 acorns). Score and coins are separate: score is for performance and the leaderboard; coins are a wallet balance. The first-clear grant, profile update, progress record, wallet ledger row, and reward ledger row commit in one database transaction. Replays can improve best score/stars without issuing the first-clear coins again.

Economy values are seeded in `economy_configs` and read on the server. The configured controls include reward multipliers, revive/extra-move values, daily/session ad caps, per-level caps, and minimum spacing. Spending, daily rewards, streaks, and cosmetics are not part of this initial slice.

## Rewarded ads and verification

Rewarded ads are optional and are not required to play. No ad provider is connected, so the UI does not offer an active ad button and the provider adapter never claims a completion. `POST /api/rewards/ad/opportunity` validates the authenticated user, placement, session ownership, cooldown, and configured caps; while the provider is unavailable it records a rejected opportunity and returns `AD_UNAVAILABLE`. No coins, hints, revives, or extra moves are granted by that response.

The schema has a unique `adEventId` for future idempotency. A real provider callback, signature/token verification, claim endpoint, and verified ad-funded reward grants still need to be implemented before connecting a production ad network. The adapter is intentionally a disabled boundary, not a fake ad integration.

## API and server operations

- `GET /api/economy/config` — safe public economy configuration and provider availability
- `GET /api/rewards/balance` — authenticated player's balance
- `GET /api/rewards/history` — authenticated player's recent ledger history
- `POST /api/rewards/ad/opportunity` — authenticated, capped request; unavailable until a provider is configured
- `/api/auth/*` — Better Auth email/password endpoints
- Game session start, movement, undo, completion, and settings updates use authenticated Server Actions

## Audio, accessibility, and PWA

Original Web Audio cues cover movement, rising-pitch apple combos, keys/gates, teleports, frost slides, fragile planks, bird rescues, star chimes, hints, portals, failure, coins, and completion, alongside optional mobile haptic feedback. Procedural ambient music and sound effects can be toggled in Settings; signed-in preferences are stored on the player profile. Public leaderboard sharing is separately opt-in and defaults off. Keyboard and touch controls have accessible names, the board exposes grid coordinates and rich tile labels, and `prefers-reduced-motion` preferences disable decorative animations automatically. `app/manifest.ts` supplies dynamic PWA metadata; an offline service worker is not included yet.

## Environment variables

Copy `.env.example` when configuring a local environment. In v0/Vercel, connect Neon and set `BETTER_AUTH_SECRET` in project variables. Do not commit `.env` files or real secrets.

- `VITE_GAME_NAME` — UI name and evaluator rename override
- `GAME_NAME` — server game name fallback
- `VITE_API_URL` — same-origin API prefix (defaults to `/api`)
- `DATABASE_URL` — supplied by the Neon integration
- `BETTER_AUTH_SECRET` — random secret of at least 32 characters

## Testing & Deployment

- Run `npx tsc --noEmit` to type-check the full application.
- Compile and run `tests/game.test.ts` with `node --test` to verify all 50 dual-path levels, run-based star tiers, and all 7 deterministic mechanics.
- The project targets Vercel and reads Neon environment variables supplied by the connected integration. `next.config.mjs` adds baseline security headers. Local development and deployment require the configured database URL and Better Auth secret; the development auth configuration trusts only localhost and exact Vercel/v0-provided origins.

## Known limitations / next steps

- Connect an actual rewarded-ad provider, verify signed callbacks, and then enable ad placements; no provider or ad reward is currently active.
- Add a production admin economy dashboard, broader analytics, daily challenges/streaks, reward spending, and extended game-history filters.
- Exercise a complete sign-up/sign-in/reload/sign-out cycle with a dedicated test account before production release; this pass avoids creating test users in the connected database.
- Capture deployment screenshots and a demo video after the ad provider and remaining product surfaces are ready.
