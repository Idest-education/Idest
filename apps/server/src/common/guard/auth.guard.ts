import { IsNotEmpty } from 'class-validator';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as JWT from 'jsonwebtoken';
import { promisify } from 'util';

const verifyAsync = promisify(JWT.verify);

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const authHeader = req.headers['authorization'];
    if (!authHeader) throw new UnauthorizedException('Authorization Required');
    if (!authHeader.startsWith('Bearer '))
      throw new UnauthorizedException('Authorization Tampered');
    const token = authHeader.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET;
    try {
      const decoded = await verifyAsync(token, jwtSecret);
      req['user'] = decoded;
      console.log(decoded);
      if (!decoded) {
        throw new UnauthorizedException('Invalid token payload');
      }
      return true;
    } catch (e) {
      throw new UnauthorizedException(e);
    }
  }

}
