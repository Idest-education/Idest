import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifySupabaseJwt } from '@idest/shared';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    if (!token) throw new UnauthorizedException('No token provided');

    try {
      request.user = await verifySupabaseJwt(token, {
        jwtSecret: this.configService.get<string>('JWT_SECRET'),
        supabaseUrl: this.configService.get<string>('SUPABASE_URL'),
        issuer: this.configService.get<string>('JWT_ISSUER'),
      });
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const authHeader = request.headers?.authorization;
    if (!authHeader) return undefined;
    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
