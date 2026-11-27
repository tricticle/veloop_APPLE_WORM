import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { Apple, ArrowLeft, Leaf } from 'lucide-react'
import { AuthForm } from '@/components/auth-form'
import { Button } from '@/components/ui/button'
import { auth } from '@/lib/auth'
import { GAME_NAME } from '@/src/config/gameConfig'

export const metadata: Metadata = {
  title: 'Sign in',
  description: `Sign in to save your progress in ${GAME_NAME}.`,
}

export default async function SignInPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect('/')

  return (
    <main className="auth-page">
      <Link href="/" className="auth-back-link"><ArrowLeft aria-hidden="true" /> Back to the grove</Link>
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand-mark"><Apple aria-hidden="true" /><Leaf aria-hidden="true" /></div>
        <p className="eyebrow">Welcome back</p>
        <h1 id="auth-title">Pick up your trail.</h1>
        <p className="auth-intro">Sign in to continue your levels, keep your coins, and save your best runs.</p>
        <AuthForm mode="sign-in" gameName={GAME_NAME} />
        <p className="auth-switch">New to the grove? <Link href="/sign-up">Create an account</Link></p>
      </section>
      <p className="auth-game-name">{GAME_NAME}</p>
    </main>
  )
}
