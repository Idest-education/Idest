import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const requiredEnv = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = requiredEnv.filter((k) => !config.get<string>(k));
  if (missing.length) {
    throw new Error(
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

  const corsOrigins = (
    config.get<string>('CORS_ORIGINS') || 'http://localhost:3000'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({ origin: corsOrigins, credentials: true });
  app.use(helmet());

  const port = Number(config.get<string>('PORT')) || 8000;
  await app.listen(port);
}
bootstrap();
