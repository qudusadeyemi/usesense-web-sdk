import { describe, it, expect } from 'vitest';
import { getEngineStyles, type EngineTheme } from '../components/styles';

/**
 * The capture screen used to take `primaryColor` and nothing else, so a fully
 * white-labelled Flow still handed the subject an unbranded dark screen at the
 * step they look at most. These lock in both halves of the fix: themed output
 * when tokens are supplied, and byte-for-byte the old palette when they are not.
 */
describe('getEngineStyles', () => {
  it('emits the original palette when no theme is passed', () => {
    const css = getEngineStyles('#4F7CFF');
    expect(css).toContain('--us-bg: #1C1A17');
    expect(css).toContain('--us-fg: #FFFFFF');
    expect(css).toContain('--us-muted: #6B6760');
    expect(css).toContain('--us-border: #E8E5DE');
    expect(css).toContain('--us-destructive: #FF6B4A');
    expect(css).toContain('--us-light-bg: #FDFCFA');
  });

  it('applies supplied tokens', () => {
    const theme: EngineTheme = { bg: '#003366', fg: '#EEEEEE', fontBody: "'Inter', sans-serif" };
    const css = getEngineStyles('#FF0000', theme);
    expect(css).toContain('--us-bg: #003366');
    expect(css).toContain('--us-fg: #EEEEEE');
    expect(css).toContain("--us-font-body: 'Inter', sans-serif");
    expect(css).toContain('--us-primary: #FF0000');
  });

  it('falls back per-token, so a partial theme does not blank the rest', () => {
    const css = getEngineStyles('#4F7CFF', { bg: '#000000' });
    expect(css).toContain('--us-bg: #000000');
    expect(css).toContain('--us-muted: #6B6760'); // untouched default
  });

  it('routes the palette through variables rather than baked-in literals', () => {
    const css = getEngineStyles('#4F7CFF', { bg: '#003366', muted: '#AABBCC' });
    // The old hardcoded values must not survive anywhere in the rule bodies,
    // or a themed run would show patches of the default palette.
    const body = css.slice(css.indexOf('.usesense-engine {', 40));
    expect(body).not.toContain('#1C1A17');
    expect(body).not.toContain('#6B6760');
  });

  it('primaryColor still drives the accent', () => {
    expect(getEngineStyles('#123456')).toContain('#123456');
  });
});
