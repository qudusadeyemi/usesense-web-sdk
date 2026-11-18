import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { loadHistory } from '../lib/history';
import { useDemo } from '../lib/settings';
import { allScenarios, makeContext } from '../scenarios';
import { SenseMark } from './Panel';

export function EnvPill() {
  const { settings, activeKey } = useDemo();
  if (settings.liveMode === 'off' || !activeKey) return <span className="pill off">Scripted only</span>;
  return settings.liveMode === 'live' ? <span className="pill live">Live</span> : <span className="pill sandbox">Sandbox</span>;
}

function Links({ count, demos }: { count: number; demos: number }) {
  const cls = ({ isActive }: { isActive: boolean }) => `nav${isActive ? ' active' : ''}`;
  return (
    <>
      <NavLink className={cls} to="/setup">Set up</NavLink>
      <NavLink className={cls} to="/scenarios">Scenarios <em>{count}</em></NavLink>
      <NavLink className={cls} to="/stage">Stage</NavLink>
      <NavLink className={cls} to="/demos">Demos <em>{demos || ''}</em></NavLink>
    </>
  );
}

export function Layout() {
  const demo = useDemo();
  const auth = useAuth();
  const count = allScenarios(makeContext(demo.market, demo.industry, demo.brand)).length;
  const demos = new Set(loadHistory().map((h) => h.prospect)).size;
  return (
    <div className="shell">
      <aside className="side" aria-label="Demo console">
        <div className="brandrow"><SenseMark /><div>Sense Demo<small>XYZ Bank</small></div></div>
        <Links count={count} demos={demos} />
        <div className="navlbl">Open</div>
        <a className="nav" href="https://watchtower.usesense.ai" target="_blank" rel="noreferrer">Watchtower</a>
        <a className="nav" href="https://usesense.ai" target="_blank" rel="noreferrer">usesense.ai</a>
        <div className="foot">
          <span className="muted">{auth.name ?? auth.email}</span>
          <button className="btn sm" onClick={() => auth.signOut()} hidden={auth.disabled}>Sign out</button>
        </div>
      </aside>
      <div className="main">
        <nav className="mobile-nav" aria-label="Demo console"><Links count={count} demos={demos} /></nav>
        <div className="topbar">
          <div className="ctx grow">
            <span className="eyebrow">Showing</span>
            <b>{demo.brand.coBranded ? demo.brand.name : 'XYZ Bank'}</b>
            <span className="faint small">{demo.industry.label} · {demo.market.label}</span>
          </div>
          <EnvPill />
        </div>
        <Outlet />
      </div>
    </div>
  );
}
