import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // DEMO MODE: disable CORS restrictions (allow any origin).
  // Using `origin: true` reflects request origin and works with credentials.
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const config = new DocumentBuilder()
    .setTitle('Assignment Microservice')
    .setDescription(`
  <h3>Available API Docs:</h3>
  <ul>
    <li><a href="${process.env.API_URL}/api">Main Service </a></li>
    <li><a href="/api">Assignment Service</a></li>
  </ul>
  `)
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  await app.listen(process.env.PORT ?? 8008);
}
bootstrap();
