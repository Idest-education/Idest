import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifySupabaseJwt, JwtVerificationError } from '@idest/shared';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

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
    } catch (err) {
      if (
        err instanceof JwtVerificationError &&
        err.reason === 'misconfigured'
      ) {
        this.logger.error(
          'JWT verification misconfigured: set JWT_SECRET or SUPABASE_URL',
        );
      }
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
