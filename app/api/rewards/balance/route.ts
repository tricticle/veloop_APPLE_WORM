import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { gameProfiles } from '@/lib/db/schema'

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [profile] = await db.select({ coins: gameProfiles.coins })
    .from(gameProfiles)
    .where(eq(gameProfiles.userId, session.user.id))
    .limit(1)

  return NextResponse.json({ balance: profile?.coins ?? 0 })
}
