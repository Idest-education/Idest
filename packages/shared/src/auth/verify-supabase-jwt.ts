import {
  jwtVerify,
  createRemoteJWKSet,
  errors as joseErrors,
  type JWTPayload,
} from 'jose';

export interface SupabaseJwtPayload extends JWTPayload {
  sub: string;
  email?: string;
  role?: string;
  aud?: string | string[];
}

export interface VerifySupabaseJwtOptions {
  /** Supabase legacy HS256 shared secret (process.env.JWT_SECRET). */
  jwtSecret?: string;
  /** Supabase project URL (process.env.SUPABASE_URL); enables the JWKS fallback. */
  supabaseUrl?: string;
  /** Expected issuer for the HS256 path (process.env.JWT_ISSUER). Optional. */
  issuer?: string;
}

export type JwtVerificationReason = 'expired' | 'invalid' | 'misconfigured';

export class JwtVerificationError extends Error {
  constructor(
    message: string,
    public readonly reason: JwtVerificationReason,
  ) {
    super(message);
    this.name = 'JwtVerificationError';
  }
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwksFor(supabaseUrl: string) {
  const base = supabaseUrl.replace(/\/+$/, '');
  const url = `${base}/auth/v1/.well-known/jwks.json`;
  let set = jwksCache.get(url);
  if (!set) {
    set = createRemoteJWKSet(new URL(url));
    jwksCache.set(url, set);
  }
  return set;
}

function assertSub(payload: JWTPayload): SupabaseJwtPayload {
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new JwtVerificationError('Token missing sub claim', 'invalid');
  }
  return payload as SupabaseJwtPayload;
}

export async function verifySupabaseJwt(
  token: string,
  opts: VerifySupabaseJwtOptions,
): Promise<SupabaseJwtPayload> {
  const jwtSecret = opts.jwtSecret?.trim() || undefined;
  const supabaseUrl = opts.supabaseUrl?.trim().replace(/\/+$/, '') || undefined;

  if (!jwtSecret && !supabaseUrl) {
    throw new JwtVerificationError(
      'JWT verification is not configured (need JWT_SECRET or SUPABASE_URL)',
      'misconfigured',
    );
  }

  // 1. HS256 with the shared secret.
  if (jwtSecret) {
    try {
      const key = new TextEncoder().encode(jwtSecret);
      const { payload } = await jwtVerify(token, key, {
        algorithms: ['HS256'],
        ...(opts.issuer ? { issuer: opts.issuer } : {}),
      });
      return assertSub(payload);
    } catch (err) {
      if (err instanceof joseErrors.JWTExpired) {
        throw new JwtVerificationError('Token expired', 'expired');
      }
      if (!supabaseUrl) {
        throw new JwtVerificationError('Invalid token signature', 'invalid');
      }
      // otherwise fall through to JWKS
    }
  }

  // 2. Asymmetric verification against Supabase JWKS.
  try {
    const { payload } = await jwtVerify(token, jwksFor(supabaseUrl!), {
      algorithms: ['RS256', 'ES256'],
      issuer: `${supabaseUrl}/auth/v1`,
    });
    return assertSub(payload);
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      throw new JwtVerificationError('Token expired', 'expired');
    }
    if (err instanceof JwtVerificationError) throw err;
    throw new JwtVerificationError('Invalid token', 'invalid');
  }
}
