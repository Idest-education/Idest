import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtPayload, decode, verify } from 'jsonwebtoken';
import { PrismaService } from '../../prisma/prisma.service';
import { Reflector } from '@nestjs/core';

export function verifyTokenAsync(token: string, secret: string): Promise<JwtPayload> {
  return new Promise((resolve, reject) => {
    verify(token, secret, { algorithms: ['HS256'] }, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded as JwtPayload);
    });
  });
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {

    const isPublic = this.reflector.getAllAndOverride<boolean>(
      'isPublic',
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const authHeader = req.headers['authorization'];
    if (!authHeader) throw new UnauthorizedException('Authorization is Required');
    if (!authHeader.startsWith('Bearer '))
      throw new UnauthorizedException('Authorization JWT Tampered');
    const token = authHeader.split(' ')[1];
    
    try {
      // Verify Supabase JWT token signature
      // Supabase tokens are signed with SUPABASE_JWT_SECRET or service role key
      const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      let decoded: JwtPayload;
      
      if (!supabaseJwtSecret) {
        console.warn('SUPABASE_JWT_SECRET not set, falling back to decode-only (INSECURE)');
        // Fallback to decode-only if secret not available (should not happen in production)
        decoded = decode(token, { complete: false }) as JwtPayload;
        if (!decoded || !decoded.sub) {
          throw new UnauthorizedException('Invalid token payload');
        }
      } else {
        // Properly verify the token signature
        decoded = await verifyTokenAsync(token, supabaseJwtSecret);
        
        if (!decoded || !decoded.sub) {
          throw new UnauthorizedException('Invalid token payload');
        }
        
        // Verify token hasn't expired
        const now = Math.floor(Date.now() / 1000);
        if (decoded.exp && decoded.exp < now) {
          throw new UnauthorizedException('Token has expired');
        }
      }

      const user = await this.prisma.user.findUnique({
        where: { id: decoded.sub },
        select: {
          id: true,
          email: true,
          full_name: true,
          role: true,
          avatar_url: true,
          is_active: true,
        },
      });
      
      if(!user) throw new UnauthorizedException('User not found');
      if(!user.is_active) throw new UnauthorizedException('User is banned or not active');
      
      req['user'] = {
        ...decoded,
        role: user.role, // Always use database role as source of truth
        avatar_url: user.avatar_url,
      };

      return true;
    } catch (e) {
      console.error('Auth error:', e);
      throw new UnauthorizedException(`Unknown Authentication failed ${e}`);
    }
  }
}
