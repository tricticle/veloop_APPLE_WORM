'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { authClient } from '@/lib/auth-client'

type AuthFormProps = {
  mode: 'sign-in' | 'sign-up'
  gameName: string
}

export function AuthForm({ mode, gameName }: AuthFormProps) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isPending, setIsPending] = useState(false)
  const isSignUp = mode === 'sign-up'

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setIsPending(true)

    try {
      const result = isSignUp
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password })

      if (result.error) {
        setErrorMessage('We couldn’t complete that request. Check your details and try again.')
        return
      }

      router.push('/')
      router.refresh()
    } catch {
      setErrorMessage('We couldn’t complete that request. Check your details and try again.')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <FieldGroup className="auth-fields">
        {isSignUp && (
          <Field>
            <FieldLabel htmlFor="name">Your name</FieldLabel>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Robin Green"
              required
              maxLength={80}
            />
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="email">Email address</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
            minLength={8}
            required
          />
          {isSignUp && <FieldDescription>Use at least 8 characters. Your game progress will be saved to your account.</FieldDescription>}
        </Field>
      </FieldGroup>
      {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}
      <Button className="auth-submit" type="submit" size="lg" disabled={isPending}>
        {isPending ? 'One moment…' : isSignUp ? 'Create your account' : 'Sign in'}
      </Button>
      <p className="auth-footnote">By continuing, you agree to play kindly and keep your account secure.</p>
      <span className="sr-only">{gameName}</span>
    </form>
  )
}
