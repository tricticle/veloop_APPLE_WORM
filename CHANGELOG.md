# Changelog

## Dual-Path Levels, Visual Redesign & 7 Mechanics Upgrade

### 1. Dual-Path Level Architecture & Star System (`lib/game/types.ts`, `lib/game/levels-handcrafted.ts`, `lib/game/levels.ts`, `lib/game/engine.ts`)
- **Dual-route catalog across all 50 levels**: Every level now defines `optimalSolution` (3★ route), `fallbackSolution` (1★ safe-but-worse route), `optimalMoves`, `fallbackMoves`, and explicit `starThresholds`.
- **No route-template cloning**: Authored Levels 1–20 as individually designed layouts and replaced Levels 21–50 with 30 distinct non-templated trails spanning 12 7x7 and 8x8 mechanic archetypes.
- **Strict module-load validation**: `validateLevelDualPaths()` simulates both `optimalSolution` and `fallbackSolution` through the shared engine at module load, throwing immediately if either fails to win, earns the wrong star count, or if `optimalSolution` is not strictly better than `fallbackSolution` (`optimalMoves < fallbackMoves || optimalGolden > fallbackGolden`).
- **Run-based star calculation & server integrity**: `calculateStars(level, state)` evaluates actual moves used, normal apples, optional golden apples, and rescued birds. `app/actions/game.ts` replays moves server-side and recomputes stars on the server.
- **Dual hint modes**: `findHintDirection()` targets the 3★ optimal route by default (`'optimal'`) and supports `'safe'` mode (toggleable in Settings) for players seeking the 1★ fallback route.
- **Post-clear ghost path reveal**: Added a **Compare 3★ path** toggle on the completion overlay to compare the player's actual `routeTaken` against the 3★ `solutionPath` right on the board.

### 2. Worm Tail & Bird Companion Visual Redesign (`components/game/game-board.tsx`, `components/game/bird-companion.tsx`, `app/globals.css`)
- **Redesigned worm body & tail**: Added a tapered rounded tail with chartreuse tip highlight and trailing wiggle animation, smooth body polylines cleanly split across teleport jumps (`splitContiguousPaths`), squash-and-stretch on move, growth pop on apple collection, and blinking eyes with near-apple/near-danger/win/fail expressions.
- **Pip the Robin companion**: Created `BirdCompanion` with head tilt, fluttering wing, blinking eye, reactive moods (`idle`, `happy`, `cheer`, `worry`), and dynamic toast prompts.
- **Grove juice & accessibility**: Added floating `+score` combo popups, rising-pitch streak Web Audio cues, mobile haptics toggle, subtle ambient leaf/firefly motes, celebration confetti on clear, rewind/reset feedback flashes, and hover move chevrons—all respecting `@media (prefers-reduced-motion: reduce)`.

### 3. Seven Deterministic Mechanics (`lib/game/engine.ts`, `lib/game/audio.ts`, `components/game/game-board.tsx`)
- **Keys & color/ID-matched gates** (`key`, `gate` with `keyId` & `color`).
- **Paired teleport warp stones** (`teleport` pairs `warp-1` / `warp-2` with tail-collision safety checks).
- **Frost/ice slide tiles** (`ice`: slides deterministically until non-ice, wall, border, or locked gate).
- **Fragile planks** (`fragile`: cracks on cross and collapses into fatal burrow hollows once vacated by the worm's tail).
- **Timed pulsing brambles & swooping patrol birds** (`spike` with `period`/`activeOffset` and `moving` with `path`).
- **Songbird rescue objectives** (`trappedBird` / `BIRD_RESCUE`: portal unlocks once required birds are freed).
- **Optional bonus golden apples & combo streaks** (`golden` apples optional for clearing, required for 3★ perfection).

### 4. Level Select, Achievements & Database Migration (`drizzle/0001_dual_path_and_mechanics.sql`, `lib/db/schema.ts`, `lib/db/index.ts`)
- Updated Level Select with world star tallies (`X/30`), total star counters (`X of 150 stars`), and `"3★ open"` badges on cleared `<3★` levels.
- Added new achievements: **First 3★**, **No-Undo Clear**, **Bird Saver**, and **Perfect Chapter**.
- Added non-destructive additive SQL migration (`drizzle/0001_dual_path_and_mechanics.sql`) and idempotent `ensureExtendedSchema()` startup checks:
  - `game_profiles`: `no_undo_clears`, `birds_rescued`
  - `level_progress`: `best_route_type`, `no_undo_clear`
  - `game_sessions`: `used_undo`, `stars_earned`
  - Run `drizzle/0001_dual_path_and_mechanics.sql` against your Neon/Postgres database (or rely on automatic `ADD COLUMN IF NOT EXISTS` in `ensureExtendedSchema()`).
