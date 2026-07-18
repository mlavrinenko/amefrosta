import { describe, it, expect } from 'vitest';
import { feedbackUrl } from './feedback';
import { PACK_CODES } from '../packs';

const env = { version: '9.9.9', platform: 'TestAgent/1.0' };

/** Decode the prefilled body query param back to markdown. */
function body(url: string): string {
  return new URL(url).searchParams.get('body') ?? '';
}

describe('feedbackUrl', () => {
  it('targets the repo new-issue endpoint with the feedback label', () => {
    const u = new URL(feedbackUrl('en', env));
    expect(u.origin + u.pathname).toBe('https://github.com/mlavrinenko/amefrosta/issues/new');
    expect(u.searchParams.get('labels')).toBe('feedback');
  });

  it('embeds the injected environment (version, language, device)', () => {
    const b = body(feedbackUrl('en', env));
    expect(b).toContain('Amefrosta 9.9.9');
    expect(b).toContain('Language: en');
    expect(b).toContain('TestAgent/1.0');
  });

  it('picks the template matching the language', () => {
    expect(new URL(feedbackUrl('en', env)).searchParams.get('title')).toBe('Feedback: ');
    expect(new URL(feedbackUrl('ru', env)).searchParams.get('title')).toBe('Отзыв: ');
    expect(body(feedbackUrl('ru', env))).toContain('Что случилось?');
  });

  it('produces a valid template for every pack language', () => {
    for (const code of PACK_CODES) {
      const b = body(feedbackUrl(code, env));
      expect(b.length).toBeGreaterThan(0);
      // The language row's label is localized; assert the code lands on it.
      expect(b).toContain(`: ${code}`);
    }
  });
});
