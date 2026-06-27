'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

const COMPANY_SIZES = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1000+',
];

const USE_CASES = [
  'Identity Verification',
  'Fraud Prevention',
  'Account Recovery',
  'Age Verification',
  'Compliance / KYC',
  'Other',
];

const MONTHLY_VOLUMES = [
  'Under 1,000',
  '1,000 - 10,000',
  '10,000 - 100,000',
  '100,000 - 1,000,000',
  '1,000,000+',
];

interface FormData {
  name: string;
  company: string;
  email: string;
  companySize: string;
  useCase: string;
  monthlyVolume: string;
}

export default function VerifyPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>({
    name: '',
    company: '',
    email: '',
    companySize: '',
    useCase: '',
    monthlyVolume: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValid =
    form.name.trim() &&
    form.company.trim() &&
    form.email.trim() &&
    form.companySize &&
    form.useCase &&
    form.monthlyVolume;

  const updateField = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setIsSubmitting(true);

    // Build a deterministic external ID from customer info
    const externalId = `demo-${form.email.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;

    // Store lead info in sessionStorage so the demo page can attach it
    // as session metadata without exposing PII in the URL.
    sessionStorage.setItem(
      'usesense_lead',
      JSON.stringify({
        name: form.name,
        company: form.company,
        email: form.email,
        company_size: form.companySize,
        use_case: form.useCase,
        monthly_volume: form.monthlyVolume,
      }),
    );

    const params = new URLSearchParams({ externalId, autostart: '1' });
    router.push(`/?${params.toString()}`);
  };

  return (
    <div className="us-verify-page" style={styles.page}>
      <div style={styles.container}>
        {/* Hero */}
        <div style={styles.hero}>
          <div style={styles.logoWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Sense" style={{ height: 40 }} />
          </div>
          <h1 className="us-verify-heading" style={styles.heading}>Prove You Are a Real Human</h1>
          <p style={styles.subheading}>
            Experience <span style={{ whiteSpace: 'nowrap' }}>Sense</span> biometric verification first-hand. Fill in your
            details below and we will launch a live demo session for you.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="us-verify-card" style={styles.card}>
          <h2 style={styles.cardTitle}>Get Started with <span style={{ whiteSpace: 'nowrap' }}>Sense</span></h2>
          <p style={styles.cardSubtitle}>
            See how <span style={{ whiteSpace: 'nowrap' }}>Sense</span> can secure your platform
          </p>

          <div style={styles.fieldStack}>
            {/* Name */}
            <div>
              <label style={styles.label}>Name</label>
              <input
                style={styles.input}
                type="text"
                required
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
              />
            </div>

            {/* Company */}
            <div>
              <label style={styles.label}>Company</label>
              <input
                style={styles.input}
                type="text"
                required
                value={form.company}
                onChange={(e) => updateField('company', e.target.value)}
              />
            </div>

            {/* Work Email */}
            <div>
              <label style={styles.label}>Work Email</label>
              <input
                style={styles.input}
                type="email"
                required
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
              />
            </div>

            {/* Company Size */}
            <div>
              <label style={styles.label}>Company Size</label>
              <select
                style={styles.select}
                required
                value={form.companySize}
                onChange={(e) => updateField('companySize', e.target.value)}
              >
                <option value="" disabled>
                  Select company size
                </option>
                {COMPANY_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Use Case */}
            <div>
              <label style={styles.label}>Use Case</label>
              <select
                style={styles.select}
                required
                value={form.useCase}
                onChange={(e) => updateField('useCase', e.target.value)}
              >
                <option value="" disabled>
                  Select use case
                </option>
                {USE_CASES.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            {/* Monthly Session Volume */}
            <div>
              <label style={styles.label}>Monthly Session Volume</label>
              <select
                style={styles.select}
                required
                value={form.monthlyVolume}
                onChange={(e) => updateField('monthlyVolume', e.target.value)}
              >
                <option value="" disabled>
                  Select monthly volume
                </option>
                {MONTHLY_VOLUMES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="us-verify-submit"
            style={styles.submitBtn(!!isValid && !isSubmitting)}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? 'Launching Demo...' : 'Prove You Are a Real Human'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    minHeight: '100vh',
    fontFamily: "'DM Sans', sans-serif",
    background: '#FDFCFA',
    color: '#1C1A17',
    padding: '40px 16px',
  },
  container: {
    width: '100%',
    maxWidth: '540px',
  },
  hero: {
    textAlign: 'center' as const,
    marginBottom: '32px',
  },
  logoWrap: {
    marginBottom: '24px',
    display: 'flex',
    justifyContent: 'center',
  },
  heading: {
    fontSize: '2.4rem',
    fontWeight: 800,
    fontFamily: "'Outfit', sans-serif",
    letterSpacing: '-0.05em',
    lineHeight: 1.05,
    color: '#1C1A17',
    marginBottom: '12px',
  },
  subheading: {
    fontSize: '0.88rem',
    fontFamily: "'DM Sans', sans-serif",
    color: '#6B6760',
    lineHeight: '1.65',
    maxWidth: '440px',
    margin: '0 auto',
  },
  card: {
    background: '#FFFFFF',
    borderRadius: '20px',
    border: '1px solid #E8E5DE',
    boxShadow: '0 4px 12px rgba(0,0,0,0.07)',
    padding: '32px',
  },
  cardTitle: {
    fontSize: '1.35rem',
    fontWeight: 700,
    fontFamily: "'Outfit', sans-serif",
    letterSpacing: '-0.02em',
    color: '#1C1A17',
    marginBottom: '4px',
  },
  cardSubtitle: {
    fontSize: '0.88rem',
    fontFamily: "'DM Sans', sans-serif",
    color: '#6B6760',
    marginBottom: '28px',
  },
  fieldStack: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
    marginBottom: '28px',
  },
  label: {
    display: 'block',
    fontSize: '0.72rem',
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    color: '#6B6760',
    marginBottom: '6px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  },
  input: {
    width: '100%',
    height: '44px',
    padding: '0 16px',
    border: '1px solid #E8E5DE',
    borderRadius: '10px',
    fontSize: '0.88rem',
    fontFamily: "'DM Sans', sans-serif",
    outline: 'none',
    boxSizing: 'border-box' as const,
    background: '#FFFFFF',
    color: '#1C1A17',
    transition: 'border-color 150ms cubic-bezier(0.16, 1, 0.3, 1)',
  },
  select: {
    width: '100%',
    height: '44px',
    padding: '0 16px',
    border: '1px solid #E8E5DE',
    borderRadius: '10px',
    fontSize: '0.88rem',
    fontFamily: "'DM Sans', sans-serif",
    outline: 'none',
    background: '#FFFFFF',
    color: '#1C1A17',
    cursor: 'pointer',
    boxSizing: 'border-box' as const,
    appearance: 'none' as const,
    backgroundImage:
      'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath d=\'M3 5l3 3 3-3\' stroke=\'%239E9A92\' stroke-width=\'1.5\' fill=\'none\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E")',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 14px center',
  },
  submitBtn: (enabled: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '52px',
    padding: '0 32px',
    border: 'none',
    borderRadius: '14px',
    fontSize: '1rem',
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    cursor: enabled ? 'pointer' : 'not-allowed',
    background: enabled ? '#4F7CFF' : '#9E9A92',
    color: '#FFFFFF',
    transition: 'all 150ms cubic-bezier(0.16, 1, 0.3, 1)',
    opacity: enabled ? 1 : 0.4,
  }),
};
