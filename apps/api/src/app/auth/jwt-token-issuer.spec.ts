import { createMock } from '@golevelup/ts-vitest';
import { JwtService } from '@nestjs/jwt';
import { err, ok } from 'neverthrow';
import { describe, expect, it } from 'vitest';

import { JwtTokenIssuer } from '@/app/auth/jwt-token-issuer.js';
import { AppConfig } from '@/app/config/app-config.js';
import { TokenIssueError } from '@/shared-kernel/auth/token-issuer.port.js';

const config = createMock<AppConfig>({ JWT_EXPIRES_IN: 120 });

describe('jwt token issuer', () => {
  it('signs only sub and email and returns the configured lifetime', async () => {
    const jwtService = createMock<JwtService>({ signAsync: () => Promise.resolve('signed.jwt') });

    const result = await new JwtTokenIssuer(jwtService, config).issue({
      email: 'ada@example.com',
      id: 'u1',
    });

    expect(result).toEqual(ok({ accessToken: 'signed.jwt', expiresIn: 120 }));
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      { email: 'ada@example.com', sub: 'u1' },
      { expiresIn: 120 },
    );
  });

  it('maps a signing failure to a TokenIssueError', async () => {
    const jwtService = createMock<JwtService>({ signAsync: () => Promise.reject(new Error('x')) });

    const result = await new JwtTokenIssuer(jwtService, config).issue({
      email: 'ada@example.com',
      id: 'u1',
    });

    expect(result).toEqual(err(new TokenIssueError()));
  });
});
