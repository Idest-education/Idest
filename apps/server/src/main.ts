import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AllExceptionFilter } from './common/filters/exception.filter';
import { SuccessEnvelopeInterceptor } from './common/interceptors/response.interceptor';
import { SwaggerModule } from '@nestjs/swagger';
import { DocumentBuilder } from '@nestjs/swagger';
import { Reflector } from '@nestjs/core';
import { createProxyMiddleware } from 'http-proxy-middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const requiredEnv = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = requiredEnv.filter((k) => !config.get<string>(k));
  if (missing.length) {
    throw new InternalServerErrorException(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionFilter());
  app.useGlobalInterceptors(new SuccessEnvelopeInterceptor(app.get(Reflector)));
  app.use(
    '/hehe',
    createProxyMiddleware({
      target: process.env.ASSIGNMENT_URL, // assignment service
      changeOrigin: true,
      pathRewrite: { '^/hehe': '' },
    }),
  );

  const corsOrigins = (
    config.get<string>('CORS_ORIGINS') || 'http://localhost:3000'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({ origin: corsOrigins, credentials: true });
  app.use(helmet());

  const port = Number(config.get<string>('PORT')) || 8000;
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
