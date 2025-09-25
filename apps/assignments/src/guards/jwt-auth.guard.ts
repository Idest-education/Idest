import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);
    
    if (!token) {
      throw new UnauthorizedException({
        status: false,
        message: 'Token not provided',
        statusCode: HttpStatus.UNAUTHORIZED,
      });
    }

    try {
      // Verify the JWT token
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });
      
      // Validate user role by making a request to the user service
      const roleValidation = await this.validateUserRole(token);
      
      if (!roleValidation.status) {
        throw new UnauthorizedException({
          status: false,
          message: 'Invalid user role',
          statusCode: HttpStatus.UNAUTHORIZED,
        });
      }

      // Attach user info to request
      const role = roleValidation.data?.role as string | undefined;
      request['user'] = { ...payload, role };

      // Enforce write permissions: only ADMIN/TEACHER can write
      const method = request.method;
      const isWrite = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method);
      if (isWrite && (!role || !['ADMIN', 'TEACHER'].includes(role))) {
        throw new ForbiddenException({
          status: false,
          message: 'Insufficient role',
          statusCode: HttpStatus.FORBIDDEN,
        });
      }
      return true;
    } catch (error) {
      throw new UnauthorizedException({
        status: false,
        message: 'Invalid or expired token',
        statusCode: HttpStatus.UNAUTHORIZED,
      });
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private async validateUserRole(token: string): Promise<{ status: boolean; data?: { role: string } }> {
    try {
      const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:3001';
      const roleEndpoint = `${userServiceUrl}/user/role`;
      
      // Make HTTP request to user service with JWT token in Authorization header
      const response = await fetch(roleEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      // Expected response format:
      // {
      //   "status": true,
      //   "message": "Fetched successfully", 
      //   "data": {
      //     "role": "ADMIN"
      //   },
      //   "statusCode": 200
      // }

      if (response.ok) {
        const responseData = await response.json();
        
        if (responseData?.status === true && responseData?.data?.role) {
          return {
            status: true,
            data: {
              role: responseData.data.role
            }
          };
        }
      }

      return {
        status: false
      };
    } catch (error) {
      // Log error for debugging purposes
      console.error('Failed to validate user role:', error.message || error);
      return {
        status: false
      };
    }
  }
}
