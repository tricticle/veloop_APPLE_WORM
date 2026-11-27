-- Non-destructive additive migration for Dual-Path Levels, New Mechanics & Achievements
-- Safe to run multiple times (uses IF NOT EXISTS).

ALTER TABLE "game_profiles"
  ADD COLUMN IF NOT EXISTS "noUndoClears" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "birdsRescued" integer NOT NULL DEFAULT 0;

ALTER TABLE "level_progress"
  ADD COLUMN IF NOT EXISTS "bestRouteType" text DEFAULT 'STANDARD',
  ADD COLUMN IF NOT EXISTS "noUndoClear" boolean NOT NULL DEFAULT false;

ALTER TABLE "game_sessions"
  ADD COLUMN IF NOT EXISTS "usedUndo" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "starsEarned" integer;
