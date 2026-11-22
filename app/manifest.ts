import type { MetadataRoute } from 'next'
import { GAME_NAME } from '@/src/config/gameConfig'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: GAME_NAME,
    short_name: GAME_NAME,
    description: `A cozy apple-collecting puzzle adventure in ${GAME_NAME}.`,
    start_url: '/',
    display: 'standalone',
    background_color: '#f4f5ef',
    theme_color: '#f4f5ef',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
    ],
  }
}
