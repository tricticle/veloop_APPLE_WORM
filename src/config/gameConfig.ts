const DEFAULT_GAME_NAME = 'APPLE WORM ADVENTURE'

export const GAME_NAME =
  process.env.VITE_GAME_NAME || process.env.GAME_NAME || DEFAULT_GAME_NAME

export const API_URL = process.env.VITE_API_URL || '/api'
