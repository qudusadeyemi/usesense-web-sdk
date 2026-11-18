import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { DemoRoute } from './console/DemoPage';
import { Home } from './console/Home';
import { NewDemo } from './console/NewDemo';
import { SignIn } from './console/SignIn';
import { getDemo, settingsKey } from './lib/demos';
import { AuthProvider, isSignedIn, useAuth } from './lib/auth';
import { DemoProvider } from './lib/settings';

// The capture engine is heavy; pages that need it load on their own.
const Replay = lazy(() => import('./console/Replay').then((m) => ({ default: m.Replay })));
const ProspectPage = lazy(() => import('./console/ProspectPage').then((m) => ({ default: m.ProspectPage })));
const PhonePage = lazy(() => import('./console/PhonePage').then((m) => ({ default: m.PhonePage })));
const BoothPage = lazy(() => import('./console/Booth').then((m) => ({ default: m.BoothPage })));
const Present = lazy(() => import('./console/Present').then((m) => ({ default: m.Present })));
const NotesWindow = lazy(() => import('./console/Present').then((m) => ({ default: m.NotesWindow })));

function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const loc = useLocation();
  if (!auth.ready) return <div className="page faint">Loading…</div>;
  if (!isSignedIn(auth)) return <Navigate to="/signin" replace state={{ from: loc.pathname + loc.search }} />;
  return <>{children}</>;
}

function PresentRoute({ rehearse }: { rehearse?: boolean }) {
  const { id = '' } = useParams();
  if (!getDemo(id)) return <Navigate to="/" replace />;
  return <DemoProvider key={id} storageKey={settingsKey(id)}><Present demoId={id} rehearse={rehearse} /></DemoProvider>;
}

function NotesRoute() {
  const { id = '' } = useParams();
  return <NotesWindow demoId={id} />;
}

export function App() {
  return (
    <BrowserRouter basename="/xyz">
      <Suspense fallback={<div className="page faint">Loading…</div>}>
        <Routes>
          <Route path="/replay" element={<Replay />} />
          <Route path="/phone" element={<PhonePage />} />
          <Route path="/p/:id" element={<ProspectPage />} />
          <Route path="/b/:id" element={<BoothPage />} />
          <Route path="*" element={
            <AuthProvider>
              <Routes>
                <Route path="/signin" element={<SignIn />} />
                <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
                <Route path="/new" element={<RequireAuth><NewDemo /></RequireAuth>} />
                <Route path="/d/:id" element={<RequireAuth><DemoRoute /></RequireAuth>} />
                <Route path="/d/:id/present" element={<RequireAuth><PresentRoute /></RequireAuth>} />
                <Route path="/d/:id/rehearse" element={<RequireAuth><PresentRoute rehearse /></RequireAuth>} />
                <Route path="/d/:id/notes" element={<RequireAuth><NotesRoute /></RequireAuth>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AuthProvider>
          } />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
