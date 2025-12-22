import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { json } from 'express';
import { AllExceptionFilter } from './common/filters/exception.filter';
import { SuccessEnvelopeInterceptor } from './common/interceptors/response.interceptor';
import { SwaggerModule } from '@nestjs/swagger';
import { DocumentBuilder } from '@nestjs/swagger';
import { Reflector } from '@nestjs/core';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { PrismaClient } from '@prisma/client';
import { decode, JwtPayload } from 'jsonwebtoken';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const prisma = new PrismaClient();

  const requiredEnv = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = requiredEnv.filter((k) => !config.get<string>(k));
  if (missing.length) {
    throw new InternalServerErrorException(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  const corsOrigins = (
    process.env.CORS_ORIGINS || 'http://localhost:3000'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowedHeaders = ['Authorization', 'Content-Type', 'Accept', 'X-User-Role'];
  const corsOptions: CorsOptions = {
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders,
  };

  // Apply CORS before any route/proxy middleware so preflight is handled here.
  app.enableCors(corsOptions);
  app.use(helmet());

  app.use(
    json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionFilter());
  app.useGlobalInterceptors(new SuccessEnvelopeInterceptor(app.get(Reflector)));

  // Handle preflight for proxied requests explicitly to avoid passing OPTIONS to the target.
  app.use('/hehe', (req: any, res: any, next: any) => {
    if (req.method !== 'OPTIONS') {
      return next();
    }
    const origin = req.headers.origin;
    if (origin && corsOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
    }
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', allowedHeaders.join(', '));
    res.header(
      'Access-Control-Allow-Methods',
      'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    );
    res.sendStatus(204);
  });

  // Enrich proxied requests to the assignment service with the user's app-role.
  // The assignment microservice can't read our Prisma-backed role from Supabase JWT claims,
  // so we forward it in a trusted header.
  app.use('/hehe', async (req: any, _res: any, next: any) => {
    try {
      const auth = req.headers?.authorization;
      if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
        const token = auth.split(' ')[1];
        const decoded = decode(token, { complete: false }) as JwtPayload | null;
        const userId = decoded?.sub;
        if (userId) {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, is_active: true },
          });
          if (user?.is_active) {
            req.headers['x-user-role'] = user.role;
          }
        }
      }
    } catch (e) {
      // Don't block proxy traffic if enrichment fails; the microservice will enforce its own auth.
      console.error('Failed to enrich /hehe proxy request:', e);
    }
    next();
  });

  app.use(
    '/hehe',
    createProxyMiddleware({
      target: process.env.ASSIGNMENT_URL, // assignment service
      changeOrigin: true,
      pathRewrite: { '^/hehe': '' },
      onProxyReq: (proxyReq: any, req: any) => {
        if (req.headers?.authorization) {
          proxyReq.setHeader('authorization', req.headers.authorization);
        }
        if (req.headers?.['x-user-role']) {
          proxyReq.setHeader('x-user-role', req.headers['x-user-role']);
        }

        // Because Nest/Express have already consumed the request body via json()
        // middleware, http-proxy-middleware no longer has access to the raw
        // stream. We captured the raw body in req.rawBody above, so we need to
        // manually forward it to the assignment service to avoid "request aborted"
        // errors from raw-body on the target.
        const rawBody: Buffer | undefined = (req as any).rawBody;
        if (rawBody && rawBody.length > 0) {
          proxyReq.setHeader('Content-Type', 'application/json');
          proxyReq.setHeader('Content-Length', Buffer.byteLength(rawBody));
          proxyReq.write(rawBody);
        }
      },
      onProxyRes: (proxyRes: any, req: any) => {
        const origin = req.headers.origin;
        if (origin && corsOrigins.includes(origin)) {
          proxyRes.headers['access-control-allow-origin'] = origin;
          proxyRes.headers['vary'] = 'Origin';
        }
        proxyRes.headers['access-control-allow-credentials'] = 'true';
        proxyRes.headers['access-control-allow-headers'] =
          allowedHeaders.join(', ');
        proxyRes.headers['access-control-allow-methods'] =
          'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS';
      },
    } as any),
  );

  const port = Number(process.env.PORT) || 8000;
  // Swagger config
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Idest')
    .setDescription(
      `
  <h3>Available API Docs:</h3>
  <ul>
    <li><a href="/api">Main Service</a></li>
    <li><a href="http://localhost:8008/api" target="_blank">Assignment Service (remember to add /hehe and open the repo)</a></li>
  </ul>
  `
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  await app.listen(port, '0.0.0.0');
}
bootstrap();
