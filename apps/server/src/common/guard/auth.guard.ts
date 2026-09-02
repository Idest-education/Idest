import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verifySupabaseJwt } from '@idest/shared';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const authHeader = req.headers['authorization'];
    if (!authHeader) throw new UnauthorizedException('Authorization is Required');
    if (!authHeader.startsWith('Bearer '))
      throw new UnauthorizedException('Authorization header malformed');
    const token = authHeader.slice('Bearer '.length);

    let decoded;
    try {
      decoded = await verifySupabaseJwt(token, {
        jwtSecret: process.env.JWT_SECRET,
        supabaseUrl: process.env.SUPABASE_URL,
        issuer: process.env.JWT_ISSUER,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
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

    if (!user) throw new UnauthorizedException('User not found');
    if (!user.is_active)
      throw new UnauthorizedException('User is banned or not active');

    req['user'] = {
      ...decoded,
      role: user.role,
      avatar_url: user.avatar_url,
    };
    return true;
  }
}
