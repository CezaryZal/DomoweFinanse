import { useState, type FormEvent } from 'react'
import { BarChart3, Check, LogIn, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Mode = 'sign-in' | 'sign-up'
type Feedback = { type: 'error' | 'success'; message: string } | null

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [isSubmitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFeedback(null)

    if (mode === 'sign-up' && password !== passwordConfirmation) {
      setFeedback({ type: 'error', message: 'Hasła muszą być identyczne.' })
      return
    }

    setSubmitting(true)

    try {
      if (mode === 'sign-in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        })

        if (error) throw error

        setFeedback({
          type: 'success',
          message: data.session
            ? 'Konto zostało utworzone i jesteś zalogowany.'
            : 'Konto zostało utworzone. Potwierdź adres e-mail, aby się zalogować.',
        })
      }
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Nie udało się wykonać operacji. Spróbuj ponownie.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode)
    setFeedback(null)
    setPasswordConfirmation('')
  }

  const isSignUp = mode === 'sign-up'

  return <main className="auth-page">
    <section className="login-card" aria-labelledby="auth-title">
      <span className="brand-mark large"><BarChart3 size={23} /></span>
      <div className="auth-mode-switch" role="tablist" aria-label="Wybierz akcję">
        <button className={mode === 'sign-in' ? 'selected' : ''} type="button" onClick={() => switchMode('sign-in')} role="tab" aria-selected={mode === 'sign-in'}>Logowanie</button>
        <button className={isSignUp ? 'selected' : ''} type="button" onClick={() => switchMode('sign-up')} role="tab" aria-selected={isSignUp}>Rejestracja</button>
      </div>
      <h1 id="auth-title">{isSignUp ? 'Załóż konto' : 'Witaj ponownie'}</h1>
      <p>{isSignUp ? 'Utwórz konto, aby rozpocząć zarządzanie finansami gospodarstwa.' : 'Zaloguj się, aby zobaczyć finanse swojego gospodarstwa.'}</p>
      <form onSubmit={handleSubmit} noValidate>
        <label>Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ty@example.com" autoComplete="email" required />
        </label>
        <label>Hasło
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimum 6 znaków" autoComplete={isSignUp ? 'new-password' : 'current-password'} minLength={6} required />
        </label>
        {isSignUp && <label>Powtórz hasło
          <input type="password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} placeholder="Powtórz hasło" autoComplete="new-password" minLength={6} required />
        </label>}
        {feedback && <div className={`auth-feedback ${feedback.type}`} role="status" aria-live="polite">{feedback.type === 'success' && <Check size={16} />}{feedback.message}</div>}
        <button className="button primary full" type="submit" disabled={isSubmitting}>
          {isSignUp ? <UserPlus size={17} /> : <LogIn size={17} />}
          {isSubmitting ? 'Przetwarzanie…' : isSignUp ? 'Utwórz konto' : 'Zaloguj się'}
        </button>
      </form>
      <span className="login-note">Logowanie jest obsługiwane przez Supabase Auth.</span>
    </section>
  </main>
}
