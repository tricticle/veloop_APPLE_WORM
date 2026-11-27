import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { GAME_NAME } from '@/src/config/gameConfig'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: GAME_NAME,
    template: `%s | ${GAME_NAME}`,
  },
  description: `Guide a bright green worm through a handcrafted jungle of wood-grain trails, apples, and swooping birds in ${GAME_NAME}.`,
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
    description: `A playful jungle puzzle adventure with carved wooden trails and lively forest hazards.`,
    type: 'website',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#1f4a32',
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
