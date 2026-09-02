import { UnauthorizedException } from '@nestjs/common';
import { SignJWT, decodeJwt } from 'jose';
import { JwtAuthGuard } from './jwt-auth.guard';

const SECRET = 'assignments-test-secret-long-enough-value';

function config(overrides: Record<string, string | undefined> = {}) {
  const values: Record<string, string | undefined> = {
    JWT_SECRET: SECRET,
    JWT_ISSUER: 'https://ref.supabase.co/auth/v1',
    SUPABASE_URL: undefined,
    ...overrides,
  };
  return { get: (k: string) => values[k] } as any;
}

function ctx(token?: string) {
  const request: any = { headers: token ? { authorization: `Bearer ${token}` } : {} };
  return { switchToHttp: () => ({ getRequest: () => request }) } as any;
}

async function hs(claims: Record<string, unknown>, exp = '1h') {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('https://ref.supabase.co/auth/v1')
    .setExpirationTime(exp)
    .sign(new TextEncoder().encode(SECRET));
}

describe('JwtAuthGuard (assignments)', () => {
  it('rejects when no token is present', async () => {
    const guard = new JwtAuthGuard(config());
    await expect(guard.canActivate(ctx())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an unsigned/forged token (no decode fallback)', async () => {
    const forged = await new SignJWT({ sub: 'x' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer('https://ref.supabase.co/auth/v1')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('wrong-secret'));
    const guard = new JwtAuthGuard(config());
    await expect(guard.canActivate(ctx(forged))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts a valid token and sets request.user', async () => {
    const token = await hs({ sub: 'user-77', role: 'TEACHER' });
    const guard = new JwtAuthGuard(config());
    const c = ctx(token);
    await expect(guard.canActivate(c)).resolves.toBe(true);
    expect(c.switchToHttp().getRequest().user.sub).toBe('user-77');
  });
});
