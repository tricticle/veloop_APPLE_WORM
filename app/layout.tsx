import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { GAME_NAME } from '@/src/config/gameConfig'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: GAME_NAME,
    template: `%s | ${GAME_NAME}`,
  },
  description: `Guide a hungry little worm through a leafy world of apple-collecting puzzles in ${GAME_NAME}.`,
  applicationName: GAME_NAME,
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: GAME_NAME,
    description: `A cozy puzzle adventure through the apple grove.`,
    type: 'website',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f4f4ee',
  userScalable: true,
  maximumScale: 5,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
