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

    const params = new URLSearchParams({ externalId, autostart: '1' });
    router.push(`/?${params.toString()}`);
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Hero */}
        <div style={styles.hero}>
          <div style={styles.logoWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="UseSense" style={{ height: 40 }} />
          </div>
          <h1 style={styles.heading}>Prove You Are a Real Human</h1>
          <p style={styles.subheading}>
            Experience UseSense biometric verification first-hand. Fill in your
            details below and we will launch a live demo session for you.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.card}>
          <h2 style={styles.cardTitle}>Get Started with UseSense</h2>
          <p style={styles.cardSubtitle}>
            See how UseSense can secure your platform
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
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    background: '#f8f9fa',
    color: '#1a1a2e',
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
    fontSize: '28px',
    fontWeight: 800,
    letterSpacing: '-0.5px',
    color: '#1a1a2e',
    marginBottom: '12px',
  },
  subheading: {
    fontSize: '15px',
    color: '#64748b',
    lineHeight: '1.6',
    maxWidth: '440px',
    margin: '0 auto',
  },
  card: {
    background: '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
    padding: '32px',
  },
  cardTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#1a1a2e',
    marginBottom: '4px',
  },
  cardSubtitle: {
    fontSize: '14px',
    color: '#64748b',
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
    fontSize: '14px',
    fontWeight: 600,
    color: '#1a1a2e',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box' as const,
    background: '#ffffff',
    color: '#1a1a2e',
    transition: 'border-color 0.15s ease',
  },
  select: {
    width: '100%',
    padding: '12px 14px',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    fontSize: '15px',
    outline: 'none',
    background: '#ffffff',
    color: '#1a1a2e',
    cursor: 'pointer',
    boxSizing: 'border-box' as const,
    appearance: 'none' as const,
    backgroundImage:
      'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath d=\'M3 5l3 3 3-3\' stroke=\'%2394a3b8\' stroke-width=\'1.5\' fill=\'none\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E")',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 14px center',
  },
  submitBtn: (enabled: boolean): React.CSSProperties => ({
    display: 'block',
    width: '100%',
    padding: '16px 24px',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: 700,
    cursor: enabled ? 'pointer' : 'not-allowed',
    background: enabled ? '#4f46e5' : '#94a3b8',
    color: '#ffffff',
    transition: 'all 0.15s ease',
    opacity: enabled ? 1 : 0.7,
  }),
};
