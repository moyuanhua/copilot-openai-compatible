import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const proxyApiKey = process.env.PROXY_API_KEY;
    if (!proxyApiKey) {
      return true;
    }
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        error: {
          message: 'Missing or invalid Authorization header. Expected: Bearer <token>',
          type: 'invalid_request_error',
          code: 'invalid_api_key',
        },
      });
    }
    const token = authHeader.slice(7);
    if (token !== proxyApiKey) {
      throw new UnauthorizedException({
        error: {
          message: 'Invalid API key.',
          type: 'invalid_request_error',
          code: 'invalid_api_key',
        },
      });
    }
    return true;
  }
}
