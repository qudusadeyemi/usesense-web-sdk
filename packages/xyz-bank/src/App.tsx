import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './console/Layout';
import { Scenarios } from './console/Scenarios';
import { Setup } from './console/Setup';
import { SignIn } from './console/SignIn';
import { Stage } from './console/Stage';
import { Demos } from './console/Demos';
import { AuthProvider, isSignedIn, useAuth } from './lib/auth';
import { DemoProvider } from './lib/settings';

// The capture engine is heavy; only the replay and hand-off pages load on their own.
const Replay = lazy(() => import('./console/Replay').then((m) => ({ default: m.Replay })));
const ProspectPage = lazy(() => import('./console/ProspectPage').then((m) => ({ default: m.ProspectPage })));
const PhonePage = lazy(() => import('./console/PhonePage').then((m) => ({ default: m.PhonePage })));

function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const loc = useLocation();
  if (!auth.ready) return <div className="page faint">Loading…</div>;
  if (!isSignedIn(auth)) return <Navigate to="/signin" replace state={{ from: loc.pathname + loc.search }} />;
  return <>{children}</>;
}

export function App() {
  return (
    <BrowserRouter basename="/xyz">
      <Suspense fallback={<div className="page faint">Loading…</div>}>
        <Routes>
          <Route path="/replay" element={<Replay />} />
          <Route path="/phone" element={<PhonePage />} />
          <Route path="/p/:id" element={<ProspectPage />} />
          <Route path="*" element={
            <AuthProvider>
              <DemoProvider>
                <Routes>
                  <Route path="/signin" element={<SignIn />} />
                  <Route element={<RequireAuth><Layout /></RequireAuth>}>
                    <Route index element={<Navigate to="/scenarios" replace />} />
                    <Route path="/setup" element={<Setup />} />
                    <Route path="/scenarios" element={<Scenarios />} />
                    <Route path="/stage" element={<Stage />} />
                    <Route path="/stage/:id" element={<Stage />} />
                    <Route path="/demos" element={<Demos />} />
                    <Route path="*" element={<Navigate to="/scenarios" replace />} />
                  </Route>
                </Routes>
              </DemoProvider>
            </AuthProvider>
          } />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
