import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SignJWT } from 'jose';
import { AuthGuard } from './auth.guard';

const SECRET = 'test-hs256-secret-value-that-is-long-enough';
process.env.JWT_SECRET = SECRET;
process.env.JWT_ISSUER = 'https://ref.supabase.co/auth/v1';
delete process.env.SUPABASE_URL;

function ctx(authHeader?: string): ExecutionContext {
  const req: any = { headers: authHeader ? { authorization: authHeader } : {} };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

function makeGuard(user: any) {
  const prisma = { user: { findUnique: jest.fn().mockResolvedValue(user) } } as any;
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
  return { guard: new AuthGuard(prisma, reflector), prisma };
}

async function hs(claims: Record<string, unknown>, exp = '1h') {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(process.env.JWT_ISSUER!)
    .setExpirationTime(exp)
    .sign(new TextEncoder().encode(SECRET));
}

describe('AuthGuard', () => {
  it('rejects a request with no Authorization header', async () => {
    const { guard } = makeGuard(null);
    await expect(guard.canActivate(ctx())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a forged (unsigned-secret) token', async () => {
    const forged = await new SignJWT({ sub: 'admin-1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer(process.env.JWT_ISSUER!)
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('the-wrong-secret'));
    const { guard } = makeGuard({ id: 'admin-1', role: 'ADMIN', is_active: true });
    await expect(guard.canActivate(ctx(`Bearer ${forged}`))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an expired token', async () => {
    const token = await hs({ sub: 'user-1' }, '-1h');
    const { guard } = makeGuard({ id: 'user-1', role: 'STUDENT', is_active: true });
    await expect(guard.canActivate(ctx(`Bearer ${token}`))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a valid token for an inactive user', async () => {
    const token = await hs({ sub: 'user-1' });
    const { guard } = makeGuard({ id: 'user-1', role: 'STUDENT', is_active: false });
    await expect(guard.canActivate(ctx(`Bearer ${token}`))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts a valid token and sets req.user.role from the DB', async () => {
    const token = await hs({ sub: 'user-1', role: 'STUDENT' });
    const { guard } = makeGuard({ id: 'user-1', role: 'TEACHER', is_active: true, avatar_url: 'x' });
    const c = ctx(`Bearer ${token}`);
    await expect(guard.canActivate(c)).resolves.toBe(true);
    const req = c.switchToHttp().getRequest() as any;
    expect(req.user.sub).toBe('user-1');
    expect(req.user.role).toBe('TEACHER'); // DB wins over token claim
  });
});
