import { desc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { rewardTransactions, walletTransactions } from '@/lib/db/schema'

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [wallet, rewards] = await Promise.all([
    db.select({ id: walletTransactions.id, type: walletTransactions.type, amount: walletTransactions.amount, source: walletTransactions.source, createdAt: walletTransactions.createdAt })
      .from(walletTransactions)
      .where(eq(walletTransactions.userId, session.user.id))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(25),
    db.select({ id: rewardTransactions.id, type: rewardTransactions.rewardType, amount: rewardTransactions.amount, source: rewardTransactions.source, status: rewardTransactions.status, createdAt: rewardTransactions.createdAt })
      .from(rewardTransactions)
      .where(eq(rewardTransactions.userId, session.user.id))
      .orderBy(desc(rewardTransactions.createdAt))
      .limit(25),
  ])

  const history = [...wallet, ...rewards]
    .sort((first, second) => second.createdAt.getTime() - first.createdAt.getTime())
    .slice(0, 25)
    .map((entry) => ({ ...entry, createdAt: entry.createdAt.toISOString() }))

  return NextResponse.json({ history })
}
