import { Outlet } from 'react-router';
import { DemoControls } from './DemoControls';
import ScreenNavigator from './ScreenNavigator';

export default function Layout() {
  return (
    <>
      <Outlet />
      <DemoControls />
      <ScreenNavigator />
    </>
  );
}
