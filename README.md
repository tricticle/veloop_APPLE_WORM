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

- Arrow keys, WASD, direction buttons, and board swipes move the worm one tile.
- Normal and golden apples grow the actual body; golden apples add score.
- Walls block movement, spikes and pits end a run, gates require an apple objective, and moving blocks change position by turn.
- The portal checks the level objective and worm length before a clear is accepted.
- Undo restores a prior state; restart returns to the level start; hints show a next direction.
- Levels 1–10 are beginner, 11–20 easy, 21–30 medium, 31–40 hard, and 41–50 expert.
- Each catalog entry is checked against a stored, contiguous solution route when the level module loads.

The first 50 entries currently reuse five hand-authored route templates with deterministic obstacle, objective, apple, and move-limit variations. They are playable and solvability-checked, but are not yet 50 individually hand-authored puzzles.

## Architecture

- `src/config/gameConfig.ts` is the single game-name source. `VITE_GAME_NAME` takes precedence for the assignment's rename test, then `GAME_NAME`, then the default.
- `lib/game/levels.ts` defines structured levels and validates their solution paths.
- `lib/game/engine.ts` is the shared movement, collision, portal, scoring, star, and hint logic used by both browser play and server validation.
- `components/game/` contains the board, controls, level selector, rewards, achievements, leaderboard, and settings views.
- `lib/db/schema.ts` matches the live Neon schema. `lib/db/index.ts` shares one Postgres pool between Drizzle and Better Auth.
- `app/actions/game.ts` scopes sessions and profile reads/writes by the authenticated user. Each move is replayed by the server; completion and the first-clear ledger updates are transactional.
- `services/ads/ad-provider-adapter.ts` is the provider boundary. It currently reports `AD_UNAVAILABLE` rather than simulating an ad.

## Account and progression data

The Neon database contains Better Auth's `user`, `session`, `account`, and `verification` tables, plus:

- `game_profiles` — current level, aggregate score/stars, wallet, apple totals, and preferences
- `level_progress` — best score, best move count, stars, and first completion per user/level
- `game_sessions` — server-owned move state, undo history, checkpoint, and run status
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

Original Web Audio cues cover movement, apple collection, hints, portals, failure, coins, and completion. Procedural ambient music and sound effects can be toggled in Settings; signed-in preferences are stored on the player profile. Public leaderboard sharing is separately opt-in and defaults off. Keyboard and touch controls have accessible names, the board exposes grid coordinates, and reduced-motion preferences are respected. `app/manifest.ts` supplies dynamic PWA metadata; an offline service worker is not included yet.

## Environment variables

Copy `.env.example` when configuring a local environment. In v0/Vercel, connect Neon and set `BETTER_AUTH_SECRET` in project variables. Do not commit `.env` files or real secrets.

- `VITE_GAME_NAME` — UI name and evaluator rename override
- `GAME_NAME` — server game name fallback
- `VITE_API_URL` — same-origin API prefix (defaults to `/api`)
- `DATABASE_URL` — supplied by the Neon integration
- `BETTER_AUTH_SECRET` — random secret of at least 32 characters

## Deployment

The project targets Vercel and reads Neon environment variables supplied by the connected integration. `next.config.mjs` adds baseline security headers. Local development and deployment require the configured database URL and Better Auth secret; the development auth configuration trusts only localhost and exact Vercel/v0-provided origins.

## Screenshots and demo

Screenshots and a demo video have not been captured for this initial implementation. The running v0 Preview is the current interactive demo surface.

## Known limitations / next steps

- Connect an actual rewarded-ad provider, verify signed callbacks, and then enable ad placements; no provider or ad reward is currently active.
- Expand the template-based 50-level set into individually authored layouts and add more objective types (rescue, key/gate, and perfect-route challenges).
- Add a production admin economy dashboard, broader analytics, daily challenges/streaks, reward spending, and extended game-history filters.
- Exercise a complete sign-up/sign-in/reload/sign-out cycle with a dedicated test account before production release; this initial pass avoids creating test users in the connected database.
- Capture deployment screenshots and a demo video after the ad provider and remaining product surfaces are ready.
