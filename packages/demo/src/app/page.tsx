'use client';

import { useState } from 'react';
import { EnrollmentDemo } from '@/components/EnrollmentDemo';
import { AuthenticationDemo } from '@/components/AuthenticationDemo';
import { DebugView } from '@/components/DebugView';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'enrollment' | 'authentication'>('enrollment');
  const [showDebug, setShowDebug] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [webIntegrity, setWebIntegrity] = useState<any>(null);

  const handleEvent = (event: any) => {
    setEvents(prev => [...prev, event]);

    // Capture web integrity signals if present
    if (event.type === 'upload_completed' && event.data?.web_integrity) {
      setWebIntegrity(event.data.web_integrity);
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>UseSense Web SDK Demo</h1>
        <p style={styles.subtitle}>
          Production-quality human verification flows
        </p>
      </header>

      <div style={styles.controls}>
        <div style={styles.tabs}>
          <button
            style={{
              ...styles.tab,
              ...(activeTab === 'enrollment' ? styles.tabActive : {})
            }}
            onClick={() => setActiveTab('enrollment')}
          >
            Enrollment
          </button>
          <button
            style={{
              ...styles.tab,
              ...(activeTab === 'authentication' ? styles.tabActive : {})
            }}
            onClick={() => setActiveTab('authentication')}
          >
            Authentication
          </button>
        </div>

        <button
          style={styles.debugButton}
          onClick={() => setShowDebug(!showDebug)}
        >
          {showDebug ? 'Hide' : 'Show'} Debug
        </button>
      </div>

      <main style={styles.main}>
        {activeTab === 'enrollment' ? (
          <EnrollmentDemo onEvent={handleEvent} />
        ) : (
          <AuthenticationDemo onEvent={handleEvent} />
        )}
      </main>

      {showDebug && (
        <DebugView
          events={events}
          webIntegrity={webIntegrity}
          onClear={() => setEvents([])}
        />
      )}

      <footer style={styles.footer}>
        <p>© 2026 UseSense. All rights reserved.</p>
        <p style={{ marginTop: '8px', fontSize: '14px', color: '#6B7280' }}>
          This is a demo application. Use sandbox credentials for testing.
        </p>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: '32px 20px',
    textAlign: 'center',
    borderBottom: '1px solid #E5E7EB',
  },
  title: {
    fontSize: '32px',
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '16px',
    color: '#6B7280',
  },
  controls: {
    backgroundColor: '#FFFFFF',
    padding: '16px 20px',
    borderBottom: '1px solid #E5E7EB',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
  },
  tabs: {
    display: 'flex',
    gap: '8px',
  },
  tab: {
    padding: '10px 20px',
    border: '1px solid #E5E7EB',
    borderRadius: '8px',
    backgroundColor: '#FFFFFF',
    color: '#6B7280',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s',
  },
  tabActive: {
    backgroundColor: '#4F63F5',
    color: '#FFFFFF',
    borderColor: '#4F63F5',
  },
  debugButton: {
    padding: '10px 20px',
    border: '1px solid #E5E7EB',
    borderRadius: '8px',
    backgroundColor: '#FFFFFF',
    color: '#6B7280',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  main: {
    flex: 1,
    padding: '40px 20px',
    maxWidth: '1200px',
    width: '100%',
    margin: '0 auto',
  },
  footer: {
    backgroundColor: '#FFFFFF',
    padding: '24px 20px',
    textAlign: 'center',
    borderTop: '1px solid #E5E7EB',
    color: '#1A1A1A',
    fontSize: '14px',
  },
};
