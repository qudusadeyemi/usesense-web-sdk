import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'UseSense Web SDK Demo',
  description: 'Demo application for UseSense Web SDK integration',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
