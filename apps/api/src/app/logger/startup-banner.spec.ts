import { describe, expect, it } from 'vitest';

import { formatStartupBanner } from '@/app/logger/startup-banner.js';

describe('formatStartupBanner', () => {
  it('pads labels in a group to a common width', () => {
    const banner = formatStartupBanner([
      {
        rows: [
          ['Environment', 'development'],
          ['Port', '3000'],
        ],
      },
    ]);

    expect(banner).toBe('Environment: development\nPort:        3000');
  });

  it('separates groups with a blank line and aligns each group on its own', () => {
    const banner = formatStartupBanner([
      { rows: [['Port', '3000']] },
      {
        rows: [
          ['- App', 'http://localhost:3000'],
          ['- Health', 'http://localhost:3000/health'],
        ],
      },
    ]);

    expect(banner).toBe(
      [
        'Port: 3000',
        '',
        '- App:    http://localhost:3000',
        '- Health: http://localhost:3000/health',
      ].join('\n'),
    );
  });

  it('returns an empty string for no groups', () => {
    expect(formatStartupBanner([])).toBe('');
  });
});
