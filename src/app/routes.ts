/**
 * UseSense Web SDK Routes
 *
 * /                    -> DemoPage (SDK tester with mock + live modes)
 * /enroll/:sessionId   -> Hosted Enrollment Page (public, remote enrollment)
 * /verify/:sessionId   -> Hosted Verification Page (public, remote auth / action auth)
 */

import { createBrowserRouter } from 'react-router';

import DemoPage from './pages/DemoPage';
import { HostedEnrollmentPage } from './pages/HostedEnrollmentPage';
import { HostedVerificationPage } from './pages/HostedVerificationPage';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: DemoPage,
  },
  {
    path: '/enroll/:sessionId',
    Component: HostedEnrollmentPage,
  },
  {
    path: '/verify/:sessionId',
    Component: HostedVerificationPage,
  },
]);
