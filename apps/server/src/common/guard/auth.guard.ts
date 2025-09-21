import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtPayload, verify } from 'jsonwebtoken';
import { PrismaService } from '../../prisma/prisma.service';
import { Reflector } from '@nestjs/core';


export function verifyTokenAsync(token: string, secret: string): Promise<JwtPayload> {
  return new Promise((resolve, reject) => {
    verify(token, secret, { algorithms: ['HS256'], issuer: process.env.JWT_ISSUER }, (err, decoded) => {
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
    const jwtSecret = process.env.JWT_SECRET;
    try {
      const decoded = await verifyTokenAsync(token, jwtSecret!);
      if (!decoded || !decoded.sub) {
        throw new UnauthorizedException('Invalid token payload');
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
        role: user?.role,
        avatar_url: user?.avatar_url,
      };

      return true;
    } catch (e) {
      console.error('Auth error:', e);
      throw new UnauthorizedException(`Unknown Authentication failed ${e}`);
    }
  }
}
