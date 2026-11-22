import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { Apple, ArrowLeft, Leaf } from 'lucide-react'
import { AuthForm } from '@/components/auth-form'
import { auth } from '@/lib/auth'
import { GAME_NAME } from '@/src/config/gameConfig'

export const metadata: Metadata = {
  title: `Create account | ${GAME_NAME}`,
  description: `Create an account to save your progress in ${GAME_NAME}.`,
}

export default async function SignUpPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect('/')

  return (
    <main className="auth-page">
      <Link href="/" className="auth-back-link"><ArrowLeft aria-hidden="true" /> Back to the grove</Link>
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand-mark"><Apple aria-hidden="true" /><Leaf aria-hidden="true" /></div>
        <p className="eyebrow">A new adventure</p>
        <h1 id="auth-title">Make this grove yours.</h1>
        <p className="auth-intro">Create an account to save levels, collect coins, and keep your best scores.</p>
        <AuthForm mode="sign-up" gameName={GAME_NAME} />
        <p className="auth-switch">Already have an account? <Link href="/sign-in">Sign in</Link></p>
      </section>
      <p className="auth-game-name">{GAME_NAME}</p>
    </main>
  )
}
