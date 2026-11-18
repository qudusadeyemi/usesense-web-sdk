/* A small stroke icon set, drawn on one 24px grid. */
import type { SVGProps } from 'react';

const P = (d: string) => (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d={d} />
  </svg>
);

export const IcSend = P('M7 17 17 7M9 7h8v8');
export const IcAdd = P('M12 5v14M5 12h14');
export const IcCard = P('M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18M7 15h3');
export const IcSave = P('M12 3a9 9 0 1 0 9 9h-9z');
export const IcHome = P('M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z');
export const IcList = P('M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01');
export const IcUser = P('M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z');
export const IcBack = P('M15 18l-6-6 6-6');
export const IcShield = P('M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z');
export const IcLock = P('M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4');
export const IcInfo = P('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01');
export const IcCheck = P('M5 12l5 5L20 7');
export const IcX = P('M6 6l12 12M18 6 6 18');
export const IcPhone = P('M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM11 18h2');
export const IcBot = P('M5 9h14v10H5zM12 5v4M9 13h.01M15 13h.01M9 16h6');
export const IcClock = P('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2');
export const IcCar = P('M5 17h14M6 17v2M18 17v2M4 13l2-6h12l2 6v4H4zM8 13h.01M16 13h.01');
export const IcArrowRight = P('M5 12h14M13 6l6 6-6 6');
export const IcPlay = P('M7 4v16l13-8z');
export const IcPause = P('M7 4h3v16H7zM14 4h3v16h-3z');
export const IcRestart = P('M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5');
export const IcExternal = P('M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5');
export const IcCopy = P('M8 8h12v12H8zM16 8V4H4v12h4');
export const IcQr = P('M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4');
export const IcSparkle = P('M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6');
export const IcCamera = P('M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z');
