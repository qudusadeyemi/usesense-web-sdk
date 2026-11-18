import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isSignedIn, STAFF_DOMAINS, useAuth } from '../lib/auth';
import { SenseMark } from './Panel';

export function SignIn() {
  const auth = useAuth();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const back = (loc.state as { from?: string } | null)?.from ?? '/scenarios';

  if (auth.ready && isSignedIn(auth)) return <Navigate to={back} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const msg = await auth.signIn(email, password);
    setBusy(false);
    if (msg) setErr(msg);
  };

  return (
    <div className="signin">
      <div className="art">
        <div className="brandrow" style={{ color: '#fff', padding: 0, position: 'relative' }}><SenseMark />Sense Demo</div>
        <div className="stack" style={{ gap: 18 }}>
          <h1>Show them the attack. Then show them Sense stop it.</h1>
          <p>XYZ Bank is a demo bank with Sense underneath. Play each attack, flip to the genuine customer, replay it without Sense, and run the real check live.</p>
        </div>
        <div className="q4">
          <div><b>Real person?</b>Deepfakes, screens, bots</div>
          <div><b>Right person?</b>Stolen IDs, wrong faces</div>
          <div><b>Only one?</b>Duplicates, rings, network</div>
          <div><b>Still them?</b>New phones, payees, shifts</div>
        </div>
      </div>
      <div className="form">
        <form onSubmit={submit} aria-label="Sign in">
          <div className="stack" style={{ gap: 6 }}>
            <h2 style={{ fontSize: '1.5rem' }}>Sign in</h2>
            <p className="muted small">Use your Watchtower account. Sense staff only ({STAFF_DOMAINS.map((d) => '@' + d).join(', ')}).</p>
          </div>
          <div className="field"><label htmlFor="email">Work email</label><input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="field"><label htmlFor="password">Password</label><input id="password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          {err && <p className="err" role="alert">{err}</p>}
          <button className="btn pri lg" type="submit" disabled={busy || !auth.ready}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <p className="help">Forgot it? Reset your password in Watchtower, then come back.</p>
        </form>
      </div>
    </div>
  );
}
