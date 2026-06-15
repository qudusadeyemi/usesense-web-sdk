import { describe, it, expect } from 'vitest';
import { isPdf } from '../flows/pdf';

describe('isPdf', () => {
  it('detects by MIME type', () => {
    expect(isPdf({ type: 'application/pdf', name: 'whatever' })).toBe(true);
  });

  it('detects by .pdf extension, case-insensitive', () => {
    expect(isPdf({ type: '', name: 'passport.PDF' })).toBe(true);
    expect(isPdf({ type: 'application/octet-stream', name: 'doc.pdf' })).toBe(true);
  });

  it('is false for images', () => {
    expect(isPdf({ type: 'image/jpeg', name: 'photo.jpg' })).toBe(false);
    expect(isPdf({ type: 'image/png', name: 'scan.png' })).toBe(false);
  });

  it('handles missing fields defensively', () => {
    expect(isPdf({})).toBe(false);
    expect(isPdf({ name: 'no-extension' })).toBe(false);
  });
});
