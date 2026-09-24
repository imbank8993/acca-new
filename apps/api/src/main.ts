import { json } from 'express';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

import { Prisma } from '@prisma/client';

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

if (Prisma?.Decimal?.prototype) {
  (Prisma.Decimal.prototype as any).toJSON = function () {
    return this.toNumber();
  };
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  // One complete school timetable is submitted atomically, rather than in batches.
  // Increase JSON payload limit globally to avoid breaking NestJS default parser registration
  app.use(json({ limit: '50mb' }));

  // Enable HTTP Response Compression & Security Headers (Helmet)
  app.use(compression());
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3001;
  const rawOrigins = configService.get<string>('CORS_ORIGIN') || '*';
  const origins = rawOrigins === '*' ? '*' : rawOrigins.split(',').map((o) => o.trim());

  // Enable CORS
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  });

  // Global Prefix for API endpoints
  app.setGlobalPrefix('api');

  // Global Pipe for validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Global Exception Filter & Logging Interceptor
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  /**
   * Swagger Documentation Setup.
   *
   * Halamannya tidak punya autentikasi sendiri dan mendaftarkan SELURUH endpoint
   * beserta bentuk parameternya — peta lengkap permukaan serang bagi siapa pun
   * yang bisa menjangkau port ini. Di produksi harus dinyalakan secara sadar
   * lewat ENABLE_SWAGGER=true, bukan ikut hidup begitu saja.
   */
  const isProduction = (configService.get<string>('NODE_ENV') || '') === 'production';
  const swaggerEnabled = configService.get<string>('ENABLE_SWAGGER') === 'true' || !isProduction;

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('ACCA Backend API')
      .setDescription('NestJS REST API documentation for ACCA Application')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(port, '0.0.0.0');
  logger.log(`NestJS Backend is running on: http://localhost:${port}/api`);
  logger.log(
    swaggerEnabled
      ? `Swagger Documentation: http://localhost:${port}/api/docs`
      : 'Swagger Documentation: nonaktif (set ENABLE_SWAGGER=true untuk menyalakan)',
  );
}

bootstrap();


