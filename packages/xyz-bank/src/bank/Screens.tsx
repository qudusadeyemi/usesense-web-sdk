import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import QRCode from 'qrcode';
import type { Brand } from '../lib/settings';
import { formatMoney, type Industry, type Market } from '../lib/presets';
import type { CaptureMode, Screen } from '../scenarios/types';
import { Face, Mesh, type FaceKind } from './Face';
import {
  IcAdd, IcBack, IcBot, IcCar, IcCard, IcHome, IcInfo, IcList, IcLock, IcPhone, IcSave, IcSend, IcShield, IcUser,
} from './icons';

export interface BankCtx {
  brand: Brand;
  market: Market;
  industry: Industry;
}

/* ---------- frame ---------- */

export function Phone({ children, dark, bare, brandColor }: { children: ReactNode; dark?: boolean; bare?: boolean; brandColor: string }) {
  const style = { '--x-brand': brandColor, '--x-deep': deepOf(brandColor) } as CSSProperties;
  return (
    <div className={`phone${bare ? ' bare' : ''}`} style={style}>
      <div className={`scr${dark ? ' dark-scr' : ''}`}>
        <div className="island" />
        {children}
        <div className="home-ind" />
      </div>
    </div>
  );
}

/** A deep tone of the brand colour for hero surfaces. */
export function deepOf(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#0B2A23';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const k = 0.42;
  return `#${[r, g, b].map((v) => Math.round(v * k).toString(16).padStart(2, '0')).join('')}`;
}

function StatusBar({ time = '9:41' }: { time?: string }) {
  return (
    <div className="sbar">
      <span>{time}</span>
      <span className="sig"><span>5G</span><span className="bat" /></span>
    </div>
  );
}

export function Logo({ brand, light }: { brand: Brand; light?: boolean }) {
  return (
    <span className="xlogo" style={light ? { color: '#fff' } : undefined}>
      <span className="xmark">{brand.logo ? <img src={brand.logo} alt="" /> : brand.short}</span>
      {brand.name}
    </span>
  );
}

const isDark = (s: Screen) => s.kind === 'welcome' || s.kind === 'capture' || s.kind === 'otp' || (s.kind === 'shift' && s.phase === 'scan') || s.kind === 'botfarm';

export function screenIsDark(s: Screen): boolean {
  return isDark(s);
}

/* ---------- the switch ---------- */

export function BankScreen({ screen, ctx, stepKey }: { screen: Screen; ctx: BankCtx; stepKey: string }) {
  return (
    <div className={`view ${viewClass(screen)}`} key={stepKey}>
      <StatusBar time={screen.kind === 'otp' ? '02:58' : undefined} />
      {render(screen, ctx)}
    </div>
  );
}

function viewClass(s: Screen): string {
  switch (s.kind) {
    case 'welcome': return 'welcome';
    case 'capture': return 'capture';
    case 'result': return 'result';
    case 'otp': return 'lock-scr';
    case 'botfarm': return 'capture';
    case 'shift': return s.phase === 'scan' ? 'capture' : '';
    default: return '';
  }
}

function render(s: Screen, ctx: BankCtx): ReactNode {
  switch (s.kind) {
    case 'welcome': return <Welcome ctx={ctx} />;
    case 'details': return <Details s={s} ctx={ctx} />;
    case 'idnumber': return <IdNumber s={s} ctx={ctx} />;
    case 'capture': return <Capture mode={s.mode} title={s.title} sub={s.sub} />;
    case 'result': return <Result s={s} ctx={ctx} />;
    case 'home': return <Home s={s} ctx={ctx} />;
    case 'send': return <Send s={s} ctx={ctx} />;
    case 'stepup': return <StepUp s={s} ctx={ctx} />;
    case 'signin': return <SignIn s={s} ctx={ctx} />;
    case 'otp': return <Otp s={s} ctx={ctx} />;
    case 'shift': return <Shift s={s} ctx={ctx} />;
    case 'agent': return <Agent s={s} ctx={ctx} />;
    case 'botfarm': return <BotFarm count={s.count} />;
    case 'nosense': return <NoSense s={s} ctx={ctx} />;
  }
}

/* ---------- screens ---------- */

function Welcome({ ctx }: { ctx: BankCtx }) {
  return (
    <>
      <div className="orb" />
      <div className="card3d" aria-hidden="true">
        <div className="row" style={{ justifyContent: 'space-between' }}><span className="chip" /><span style={{ fontSize: 11, fontWeight: 800 }}>{ctx.brand.short}</span></div>
        <span className="num">•••• 4410</span>
      </div>
      <div className="xbody" style={{ justifyContent: 'flex-end', position: 'relative' }}>
        <Logo brand={ctx.brand} light />
        <div className="xh1" style={{ color: '#fff' }}>{ctx.industry.heroLine}</div>
        <div className="xp">Join in about two minutes. No branch, no paperwork, no waiting.</div>
        <div className="stack" style={{ gap: 10, marginTop: 6 }}>
          <button className="xbtn mint" tabIndex={-1}>{ctx.industry.signupCta}</button>
          <button className="xbtn on-dark" tabIndex={-1}>I already have an account</button>
        </div>
      </div>
    </>
  );
}

function Progress({ n }: { n: number }) {
  return <div className="progress" aria-hidden="true">{[1, 2, 3].map((i) => <i key={i} className={i <= n ? 'on' : ''} />)}</div>;
}

function Details({ s, ctx }: { s: Extract<Screen, { kind: 'details' }>; ctx: BankCtx }) {
  return (
    <div className="xbody">
      <div className="xtop"><span className="back"><IcBack width={18} height={18} /> Back</span><span className="xsmall">Step 1 of 3</span></div>
      <Progress n={1} />
      {s.byAgent && <div className="agentbar"><i>AI</i><span>Your assistant is filling this in for you</span><span className="typing-dots" style={{ marginLeft: 'auto' }}><i /><i /><i /></span></div>}
      <div className="xh2">Tell us about you</div>
      <div className="xfield"><label>Full name</label><div className="xinput"><span className="typed d1">{s.name}</span></div></div>
      <div className="xfield"><label>Email</label><div className="xinput"><span className="typed d2">{s.email}</span></div></div>
      <div className="xfield"><label>Mobile</label><div className="xinput focus"><span className="typed d3">{s.phone}</span><span className="caret" /></div></div>
      <div className="xsmall" style={{ marginTop: 'auto' }}>We use these to open your {ctx.industry.productNoun} and keep it safe.</div>
      <button className="xbtn" tabIndex={-1}>Continue</button>
    </div>
  );
}

function IdNumber({ s, ctx }: { s: Extract<Screen, { kind: 'idnumber' }>; ctx: BankCtx }) {
  const label = s.idType.replace(/^\w/, (x) => x.toUpperCase());
  return (
    <div className="xbody">
      <div className="xtop"><span className="back"><IcBack width={18} height={18} /> Back</span><span className="xsmall">Step 2 of 3</span></div>
      <Progress n={2} />
      <div className="xh2">Your {s.idType}</div>
      <div className="xp">We check it with the official record. It takes a second.</div>
      <div className="xfield"><label>{label} number</label>
        <div className="xinput focus"><span className="typed d1" style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '.04em' }}>{s.value}</span>{s.status === 'valid' && <span className="ok-tick">✓</span>}</div>
      </div>
      <div className="verifying" style={{ animation: 'fade .3s ease .4s both' }}>
        {s.status === 'valid' ? <><span className="ok-tick" style={{ marginLeft: 0, animationDelay: '1.4s' }}>✓</span><span style={{ animation: 'fade .3s ease 1.4s both' }}>Matches the record</span></> : <><span className="spinner" />Checking the record…</>}
      </div>
      <div className="xcard xsmall row" style={{ marginTop: 'auto' }}><IcShield width={18} height={18} style={{ color: 'var(--x-brand)', flex: 'none' }} /><span>Your details are encrypted and only used to verify you. {ctx.market.label}.</span></div>
      <button className="xbtn" tabIndex={-1}>Continue</button>
    </div>
  );
}

const CAP_TAG: Partial<Record<CaptureMode, { t: string; tone: 'bad' | 'ok' | 'warn' }>> = {
  genuine: { t: 'live · phone camera', tone: 'ok' },
  deepfake: { t: 'virtual camera · OBS', tone: 'bad' },
  screen: { t: 'screen detected', tone: 'bad' },
  replay: { t: 'record photo replayed', tone: 'bad' },
  emulator: { t: 'emulator · rooted', tone: 'bad' },
  otherface: { t: 'live · phone camera', tone: 'ok' },
  thief: { t: 'live · phone camera', tone: 'ok' },
  lowlight: { t: 'low light', tone: 'warn' },
};

export function FaceInOval({ mode, small }: { mode: CaptureMode; small?: boolean }) {
  const kind: FaceKind = mode === 'otherface' || mode === 'thief' ? 'b' : mode === 'lowlight' ? 'c' : 'a';
  const tag = CAP_TAG[mode];
  const bad = tag?.tone === 'bad';
  return (
    <div className={small ? 'mini-oval' : 'oval-wrap'}>
      <div className="oval">
        {mode === 'screen' ? (
          <><div className="phone-in-frame"><Face kind="a" breathe={false} /><div className="screen-ov" /></div></>
        ) : mode === 'replay' ? (
          <div className="replay-ov"><span className="lbl">RECORD PHOTO</span><Face kind="a" breathe={false} /></div>
        ) : (
          <Face kind={kind} breathe={mode !== 'deepfake'} />
        )}
        {mode === 'deepfake' && <><Mesh /><div className="inj" /></>}
        {mode === 'emulator' && <div className="emu-ov" />}
        {mode === 'lowlight' && <div className="lowlight-ov" />}
        <div className="scanline" />
      </div>
      <svg className="oval-ring" viewBox="0 0 216 276" preserveAspectRatio="none" aria-hidden="true">
        <ellipse className="track" cx="108" cy="138" rx="104" ry="134" />
        <ellipse className={`prog${bad ? ' bad' : ''}`} cx="108" cy="138" rx="104" ry="134" />
      </svg>
      {tag && !small && <span className={`cap-tag ${tag.tone}`}>{tag.t}</span>}
    </div>
  );
}

function Capture({ mode, title, sub }: { mode: CaptureMode; title?: string; sub?: string }) {
  return (
    <div className="xbody">
      <div className="cap-title"><b>{title ?? 'Look at the camera'}</b><span>{sub ?? 'Hold still for a moment. No need to move.'}</span></div>
      <FaceInOval mode={mode} />
      <div className="hint" style={{ marginTop: 10 }}><span className="dot" />{mode === 'lowlight' ? 'Try a little more light' : 'Checking it’s really you'}</div>
      <div className="cap-foot"><IcShield />Secured by Sense</div>
    </div>
  );
}

function Confetti() {
  const colors = ['#B9F3D8', '#0F5C4A', '#FFB84D', '#7c5cfc', '#4f7cff'];
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 22 }, (_, i) => (
        <i key={i} style={{ left: `${(i * 37) % 100}%`, background: colors[i % colors.length], animationDelay: `${(i % 7) * 0.06}s`, transform: `rotate(${i * 23}deg)` }} />
      ))}
    </div>
  );
}

function Result({ s, ctx }: { s: Extract<Screen, { kind: 'result' }>; ctx: BankCtx }) {
  return (
    <>
      {s.tone === 'ok' && <Confetti />}
      <div className="xbody">
        <div style={{ flex: 1 }} />
        <div className={`res-ic ${s.tone}`}>
          {s.tone === 'ok' ? <svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            : s.tone === 'stop' ? <IcLock /> : s.tone === 'review' ? <IcInfo /> : <IcList />}
        </div>
        <div className="xh2" style={{ animation: 'rise .4s var(--ease) .15s both' }}>{s.title}</div>
        <div className="xp" style={{ animation: 'rise .4s var(--ease) .25s both', maxWidth: 250 }}>{s.body}</div>
        {s.detail && <div className="detail" style={{ animation: 'rise .4s var(--ease) .35s both' }}>{s.detail}</div>}
        <div style={{ flex: 1 }} />
        {s.cta && <button className={`xbtn${s.tone === 'stop' ? ' line' : ''}`} tabIndex={-1}>{s.cta}</button>}
        <div className="xsmall"><Logo brand={ctx.brand} /></div>
      </div>
    </>
  );
}

function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function Home({ s, ctx }: { s: Extract<Screen, { kind: 'home' }>; ctx: BankCtx }) {
  const m = ctx.market;
  const whole = Math.floor(s.balance);
  const cents = Math.round((s.balance - whole) * 100);
  const sym = formatMoney(0, m).replace(/[\d.,\s]/g, '');
  return (
    <>
      <div className="xbody" style={{ paddingBottom: 12 }}>
        <div className="xtop"><span style={{ fontWeight: 800, fontSize: 17 }}>Hi {s.name.split(' ')[0]}</span><span className="avatar">{initials(s.name)}</span></div>
        {s.banner && <div className={`banner${/trusted/i.test(s.banner) ? ' ok' : ''}`}>{/trusted/i.test(s.banner) ? <IcShield width={16} /> : <IcInfo width={16} />}{s.banner}</div>}
        <div className="hero-card">
          <span className="lab">Main {ctx.industry.productNoun}</span>
          <span className="bal">{sym}{whole.toLocaleString(m.locale)}<small>.{String(cents).padStart(2, '0')}</small></span>
          {s.delta ? <span className="delta">{formatMoney(s.delta, m, { sign: true })} this month</span> : null}
        </div>
        <div className="qa">
          <div><i><IcSend /></i>{ctx.industry.payoutVerb.split(' ')[0]}</div>
          <div><i><IcAdd /></i>Add</div>
          <div><i><IcCard /></i>Cards</div>
          <div><i><IcSave /></i>Save</div>
        </div>
        <div className="xcard tx" style={{ padding: '4px 14px' }}>
          <div className="r"><span className="ic">{initials(m.merchants[0])}</span><span><b>{m.merchants[0]}</b><span>Today · Groceries</span></span><em className="out">{formatMoney(-Math.max(1, Math.round(18.4 * m.scale)), m)}</em></div>
          <div className="r"><span className="ic">{initials(m.merchants[1])}</span><span><b>{m.merchants[1]}</b><span>Today · Travel</span></span><em className="out">{formatMoney(-Math.max(1, Math.round(7.8 * m.scale)), m)}</em></div>
          <div className="r"><span className="ic">SA</span><span><b>Salary · {m.employer}</b><span>Yesterday</span></span><em className="in">{formatMoney(Math.round(3250 * m.scale), m, { sign: true })}</em></div>
        </div>
      </div>
      <div className="tabbar"><span className="on"><IcHome />Home</span><span><IcSend />Payments</span><span><IcCard />Cards</span><span><IcUser />Me</span></div>
    </>
  );
}

function Send({ s, ctx }: { s: Extract<Screen, { kind: 'send' }>; ctx: BankCtx }) {
  return (
    <div className="xbody">
      <div className="xtop"><span className="back"><IcBack width={18} height={18} /> {ctx.industry.payoutVerb}</span></div>
      <div className="xcard row" style={{ gap: 12 }}>
        <span className="avatar">{initials(s.payee)}</span>
        <span className="grow"><b style={{ fontSize: 14.5 }}>{s.payee}</b>{s.isNew && <> <span className="newtag">New payee</span></>}<br /><span className="xsmall">Account ending 4410</span></span>
      </div>
      <div style={{ flex: 1, display: 'grid', placeContent: 'center', gap: 6 }}>
        <div className="amount" style={{ animation: 'pop .4s var(--spring) both' }}>{formatMoney(s.amount, ctx.market)}</div>
        <div className="xsmall" style={{ textAlign: 'center' }}>From your main {ctx.industry.productNoun}</div>
      </div>
      <div className="xcard row xsmall"><span className="grow">Reference</span><b style={{ color: 'var(--x-ink)' }}>{s.reference}</b></div>
      <button className="xbtn" tabIndex={-1}>Review and send</button>
    </div>
  );
}

function StepUp({ s, ctx }: { s: Extract<Screen, { kind: 'stepup' }>; ctx: BankCtx }) {
  return (
    <>
      <div className="xbody">
        <div className="xtop"><span className="back"><IcBack width={18} height={18} /> {ctx.industry.payoutVerb}</span></div>
        <div className="amount" style={{ marginTop: 30, opacity: .35 }}>{formatMoney(s.amount, ctx.market)}</div>
      </div>
      <div className="scrim" />
      <div className="sheet" role="dialog" aria-label="Quick check">
        <div className="grab" />
        <div style={{ fontWeight: 800, fontSize: 18, textAlign: 'center', letterSpacing: '-.02em' }}>{s.phase === 'ask' ? 'Quick check before this goes' : 'Hold still'}</div>
        <FaceInOval mode={s.mode} small />
        {s.phase === 'ask'
          ? <div className="why"><IcInfo width={18} style={{ flex: 'none', marginTop: 1 }} /><span><b>Why now?</b> {s.reason} It takes about three seconds.</span></div>
          : <div className="hint" style={{ color: 'var(--x-muted)', justifyContent: 'center' }}><span className="dot" style={{ background: 'var(--x-brand)' }} />Checking it’s you</div>}
        <button className="xbtn" tabIndex={-1} style={{ opacity: s.phase === 'scan' ? .4 : 1 }}>{s.phase === 'ask' ? 'I’m ready' : 'Checking…'}</button>
      </div>
    </>
  );
}

function SignIn({ s, ctx }: { s: Extract<Screen, { kind: 'signin' }>; ctx: BankCtx }) {
  return (
    <div className="xbody" style={{ textAlign: 'center', alignItems: 'center' }}>
      <div style={{ marginTop: 20 }}><Logo brand={ctx.brand} /></div>
      <div className="avatar" style={{ width: 64, height: 64, fontSize: 20, marginTop: 18 }}><IcPhone width={28} /></div>
      <div className="xh2">New phone, same you?</div>
      <div className="xp" style={{ maxWidth: 250 }}>{s.note} Show us your face and you’re in. It’s how we keep your {ctx.industry.productNoun} safe.</div>
      <div className="xcard xsmall row" style={{ width: '100%' }}><IcPhone width={18} style={{ flex: 'none' }} /><span className="grow" style={{ textAlign: 'left' }}>{s.device}</span><span className="newtag">New</span></div>
      <div style={{ flex: 1 }} />
      <button className="xbtn" tabIndex={-1}>Continue</button>
      <div className="xsmall">Wasn’t you? <b style={{ color: 'var(--x-warn)' }}>Lock my {ctx.industry.productNoun}</b></div>
    </div>
  );
}

function Otp({ s, ctx }: { s: Extract<Screen, { kind: 'otp' }>; ctx: BankCtx }) {
  return (
    <div className="xbody">
      <div className="lock-time">2:58</div>
      <div className="lock-date">Wednesday</div>
      <div className="otp-bubble" style={{ marginTop: 26, color: 'var(--x-ink)' }}>
        <b className="row"><span className="xmark" style={{ width: 20, height: 20, fontSize: 7, borderRadius: 6 }}>{ctx.brand.short}</span>{ctx.brand.name}</b>
        <span>{s.note}. Don’t share it with anyone. Sent to {s.phone}.</span>
      </div>
      <div className="otp-bubble" style={{ color: 'var(--x-ink)', animationDelay: '.6s' }}>
        <b>Mobile network</b>
        <span>Your SIM has been moved to a new card. If this wasn’t you, call us.</span>
      </div>
      <div style={{ flex: 1 }} />
      <div className="xsmall" style={{ color: 'rgba(255,255,255,.55)', textAlign: 'center' }}>This is the attacker’s new SIM, not the owner’s phone</div>
    </div>
  );
}

function Shift({ s, ctx }: { s: Extract<Screen, { kind: 'shift' }>; ctx: BankCtx }) {
  if (s.phase === 'scan') return <Capture mode={s.mode} title="Start of shift" sub="A quick look and you’re online" />;
  return (
    <div className="xbody">
      <div className="xtop"><span style={{ fontWeight: 800, fontSize: 17 }}>Good evening, {s.name.split(' ')[0]}</span><span className="avatar">{initials(s.name)}</span></div>
      <div className="hero-card"><span className="lab">Today</span><span className="bal">{formatMoney(Math.round(86 * ctx.market.scale), ctx.market)}</span><span className="delta">7 trips · 4.9 rating</span></div>
      <div className="xcard row" style={{ gap: 12 }}><IcCar width={22} style={{ color: 'var(--x-brand)' }} /><span className="grow"><b style={{ fontSize: 14 }}>Ready to drive?</b><br /><span className="xsmall">High demand near {ctx.market.city}</span></span></div>
      <div style={{ flex: 1 }} />
      <div className="why"><IcShield width={18} style={{ flex: 'none' }} /><span><b>Every shift starts with a quick look,</b> so riders know it’s you.</span></div>
      <button className="xbtn brand" tabIndex={-1}>Go online</button>
    </div>
  );
}

function Qr({ value }: { value: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    QRCode.toDataURL(value, { margin: 0, width: 300, color: { dark: '#0B1F1A', light: '#ffffff' } }).then(setSrc).catch(() => setSrc(''));
  }, [value]);
  return <div className="qr">{src ? <img src={src} alt="QR code" /> : null}</div>;
}

function Agent({ s, ctx }: { s: Extract<Screen, { kind: 'agent' }>; ctx: BankCtx }) {
  if (s.stage === 'filling') {
    return (
      <div className="xbody">
        <div className="agentbar"><i>AI</i><span className="grow">{s.operator} is working on this</span><span className="typing-dots"><i /><i /><i /></span></div>
        <div className="xh2" style={{ marginTop: 10 }}>“Open {ctx.industry.product} at {ctx.brand.name} for me.”</div>
        <div className="xcard xsmall" style={{ display: 'grid', gap: 8 }}>
          {['Opened the sign-up page', 'Filled in name, email and mobile', `Entered the ${ctx.market.idType}`, 'Waiting for the face check'].map((t, i) => (
            <div key={t} className="row" style={{ animation: `rise .3s var(--ease) ${0.3 + i * 0.45}s both` }}><IcBot width={16} style={{ color: 'var(--x-brand)' }} />{t}</div>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div className="xsmall" style={{ textAlign: 'center' }}>Agents can fill in forms. Only you can show your face.</div>
      </div>
    );
  }
  if (s.stage === 'handoff') {
    return (
      <div className="xbody" style={{ textAlign: 'center' }}>
        <div className="agentbar"><i>AI</i><span style={{ textAlign: 'left' }}>{s.operator} filled in your application</span></div>
        <div className="xh2" style={{ marginTop: 6 }}>Finish on your phone</div>
        <div className="xp">Your assistant can’t do the face check. Scan this with your own phone.</div>
        <Qr value={`https://try.usesense.ai/xyz/phone#demo-${ctx.brand.short}`} />
        <div className="xsmall">The link works once, for 10 minutes.</div>
      </div>
    );
  }
  if (s.stage === 'phone') return <Capture mode="genuine" title="Approve your application" sub={`${s.operator} asked to open ${ctx.industry.product} for you`} />;
  return (
    <div className="xbody" style={{ textAlign: 'center', alignItems: 'center', justifyContent: 'center' }}>
      <div className="res-ic ok"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
      <div className="xh2">Approved by you</div>
      <div className="xp" style={{ maxWidth: 250 }}>Your assistant can finish setting up. Your face check was done by you, on your phone.</div>
    </div>
  );
}

function BotFarm({ count }: { count: number }) {
  return (
    <div className="xbody">
      <div className="cap-title"><b>{count} sign-ups, one hour</b><span>Three emulated phones, forty identities</span></div>
      <div className="farm">
        {Array.from({ length: count }, (_, i) => <i key={i} className={i % 3 === 0 ? 'hit' : ''} style={{ animationDelay: `${i * 0.04}s` }} />)}
      </div>
      <div className="hint" style={{ marginTop: 'auto' }}><span className="dot" style={{ background: '#ff6b4a' }} />01:12 to 02:14</div>
    </div>
  );
}

function NoSense({ s, ctx }: { s: Extract<Screen, { kind: 'nosense' }>; ctx: BankCtx }) {
  return (
    <div className="xbody">
      <div className="nosense-head"><IcInfo width={16} />{s.headline}</div>
      <div className="hero-card"><span className="lab">Available</span><span className="bal">{formatMoney(0, ctx.market)}<small>.00</small></span><span className="lab">Overdraft and credit used</span></div>
      <div className="loss"><span>Minutes later</span><b>{s.title}</b><span>{s.footnote}</span></div>
      <div className="xcard tx drain" style={{ padding: '4px 14px' }}>
        {s.lines.map((l) => (
          <div className="r" key={l.who + l.when}><span className="ic">{initials(l.who)}</span><span><b>{l.who}</b><span>{l.when}</span></span><em className={l.amount < 0 ? 'out' : 'in'}>{formatMoney(l.amount, ctx.market, { sign: l.amount > 0 })}</em></div>
        ))}
      </div>
    </div>
  );
}
