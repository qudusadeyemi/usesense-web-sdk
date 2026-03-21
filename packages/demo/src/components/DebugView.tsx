'use client';

interface DebugViewProps {
  events: any[];
  webIntegrity: any;
  onClear: () => void;
}

export function DebugView({ events, webIntegrity, onClear }: DebugViewProps) {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Debug Console</h3>
        <button onClick={onClear} style={styles.clearButton}>
          Clear
        </button>
      </div>

      <div style={styles.tabs}>
        <div style={styles.tab}>
          <h4 style={styles.tabTitle}>Event Log ({events.length})</h4>
          <div style={styles.eventList}>
            {events.length === 0 ? (
              <p style={styles.empty}>No events yet. Start a verification flow.</p>
            ) : (
              events.map((event, index) => (
                <div key={index} style={styles.event}>
                  <div style={styles.eventHeader}>
                    <span style={styles.eventType}>{event.type}</span>
                    <span style={styles.eventTime}>
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  {event.data && (
                    <pre style={styles.eventData}>
                      {JSON.stringify(event.data, null, 2)}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {webIntegrity && (
          <div style={styles.tab}>
            <h4 style={styles.tabTitle}>Web Integrity Signals</h4>
            <div style={styles.integrityGrid}>
              <div style={styles.integritySection}>
                <h5 style={styles.sectionTitle}>Browser</h5>
                <div style={styles.integrityItem}>
                  <span>User Agent:</span>
                  <code>{webIntegrity.user_agent}</code>
                </div>
                <div style={styles.integrityItem}>
                  <span>Platform:</span>
                  <code>{webIntegrity.platform}</code>
                </div>
                <div style={styles.integrityItem}>
                  <span>Languages:</span>
                  <code>{webIntegrity.languages?.join(', ')}</code>
                </div>
                <div style={styles.integrityItem}>
                  <span>Timezone:</span>
                  <code>{webIntegrity.timezone}</code>
                </div>
              </div>

              <div style={styles.integritySection}>
                <h5 style={styles.sectionTitle}>Hardware</h5>
                <div style={styles.integrityItem}>
                  <span>CPU Cores:</span>
                  <code>{webIntegrity.hardware_concurrency}</code>
                </div>
                <div style={styles.integrityItem}>
                  <span>Device Memory:</span>
                  <code>{webIntegrity.device_memory ? `${webIntegrity.device_memory}GB` : 'N/A'}</code>
                </div>
                <div style={styles.integrityItem}>
                  <span>Screen:</span>
                  <code>
                    {webIntegrity.screen_resolution || `${webIntegrity.screen?.width}x${webIntegrity.screen?.height}`}
                  </code>
                </div>
              </div>

              <div style={styles.integritySection}>
                <h5 style={styles.sectionTitle}>Security</h5>
                <div style={styles.integrityItem}>
                  <span>WebDriver:</span>
                  <code>{webIntegrity.webdriver ? 'YES ⚠️' : 'NO'}</code>
                </div>
                <div style={styles.integrityItem}>
                  <span>Cookies Enabled:</span>
                  <code>{webIntegrity.cookie_enabled ? 'YES' : 'NO'}</code>
                </div>
                <div style={styles.integrityItem}>
                  <span>Do Not Track:</span>
                  <code>{webIntegrity.do_not_track || 'null'}</code>
                </div>
              </div>

              <div style={styles.integritySection}>
                <h5 style={styles.sectionTitle}>Features</h5>
                <div style={styles.integrityItem}>
                  <span>WebRTC:</span>
                  <code>{webIntegrity.feature_support?.supports_webrtc ? '✓' : '✗'}</code>
                </div>
                <div style={styles.integrityItem}>
                  <span>MediaRecorder:</span>
                  <code>{webIntegrity.feature_support?.supports_media_recorder ? '✓' : '✗'}</code>
                </div>
                <div style={styles.integrityItem}>
                  <span>Permissions API:</span>
                  <code>{webIntegrity.feature_support?.supports_permissions_api ? '✓' : '✗'}</code>
                </div>
                <div style={styles.integrityItem}>
                  <span>WebGL:</span>
                  <code>{webIntegrity.feature_support?.supports_webgl ? '✓' : '✗'}</code>
                </div>
              </div>

              <div style={styles.integritySection}>
                <h5 style={styles.sectionTitle}>Media Devices</h5>
                <div style={styles.integrityItem}>
                  <span>Video Inputs:</span>
                  <code>{webIntegrity.media_devices?.videoInputs || 0}</code>
                </div>
                <div style={styles.integrityItem}>
                  <span>Audio Inputs:</span>
                  <code>{webIntegrity.media_devices?.audioInputs || 0}</code>
                </div>
              </div>

              {webIntegrity.timing_signals && (
                <div style={styles.integritySection}>
                  <h5 style={styles.sectionTitle}>Performance</h5>
                  <div style={styles.integrityItem}>
                    <span>Event Loop Lag (avg):</span>
                    <code>{webIntegrity.timing_signals.event_loop_lag_ms?.avg.toFixed(2)}ms</code>
                  </div>
                  <div style={styles.integrityItem}>
                    <span>Event Loop Lag (max):</span>
                    <code>{webIntegrity.timing_signals.event_loop_lag_ms?.max.toFixed(2)}ms</code>
                  </div>
                </div>
              )}

              {webIntegrity.webgl_fingerprint && (
                <div style={styles.integritySection}>
                  <h5 style={styles.sectionTitle}>Fingerprint</h5>
                  <div style={styles.integrityItem}>
                    <span>WebGL Hash:</span>
                    <code>{webIntegrity.webgl_fingerprint}</code>
                  </div>
                </div>
              )}
            </div>

            <details style={styles.details}>
              <summary style={styles.summary}>View Raw JSON</summary>
              <pre style={styles.jsonBlock}>
                {JSON.stringify(webIntegrity, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTop: '2px solid #E5E7EB',
    maxHeight: '400px',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 1000,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 20px',
    borderBottom: '1px solid #E5E7EB',
  },
  title: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1A1A1A',
  },
  clearButton: {
    padding: '6px 12px',
    backgroundColor: '#F3F4F6',
    border: '1px solid #E5E7EB',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  tabs: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid #E5E7EB',
    overflow: 'hidden',
  },
  tabTitle: {
    fontSize: '14px',
    fontWeight: '600',
    padding: '12px 20px',
    backgroundColor: '#F9FAFB',
    borderBottom: '1px solid #E5E7EB',
  },
  eventList: {
    flex: 1,
    overflow: 'auto',
    padding: '12px',
  },
  empty: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: '14px',
    padding: '20px',
  },
  event: {
    marginBottom: '12px',
    padding: '12px',
    backgroundColor: '#F9FAFB',
    borderRadius: '6px',
    fontSize: '12px',
  },
  eventHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  eventType: {
    fontWeight: '600',
    color: '#4F63F5',
  },
  eventTime: {
    color: '#9CA3AF',
    fontSize: '11px',
  },
  eventData: {
    backgroundColor: '#1F2937',
    color: '#F9FAFB',
    padding: '8px',
    borderRadius: '4px',
    fontSize: '11px',
    overflow: 'auto',
    maxHeight: '100px',
    fontFamily: 'monospace',
  },
  integrityGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '16px',
    padding: '16px',
    overflow: 'auto',
    flex: 1,
  },
  integritySection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: '4px',
  },
  integrityItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: '12px',
  },
  details: {
    padding: '16px',
    borderTop: '1px solid #E5E7EB',
  },
  summary: {
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '13px',
    marginBottom: '12px',
  },
  jsonBlock: {
    backgroundColor: '#1F2937',
    color: '#F9FAFB',
    padding: '12px',
    borderRadius: '6px',
    fontSize: '11px',
    overflow: 'auto',
    maxHeight: '300px',
    fontFamily: 'monospace',
  },
};