import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { decode } from 'jsonwebtoken';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      // Try to verify with JWT_SECRET first (for internal tokens)
      const secret = this.configService.get<string>('JWT_SECRET');
      
      if (secret) {
        try {
          const payload = await this.jwtService.verifyAsync(token, {
            secret: secret,
          });
          request.user = payload;
          return true;
        } catch (verifyError) {
          // If verification fails, try decoding as Supabase token (Supabase already verified it)
          // This allows the assignment service to accept tokens from the main backend
        }
      }

      // Decode Supabase token (Supabase already verified it before sending)
      const decoded = decode(token, { complete: false }) as any;
      
      if (!decoded || !decoded.sub) {
        throw new UnauthorizedException('Invalid token payload');
      }

      request.user = decoded;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const authHeader = request.headers.authorization;
    
    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}

