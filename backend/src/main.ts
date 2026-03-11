import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Sécurité HTTP
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // CORS — whitelist stricte
  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:4200').split(',');
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS non autorisé'));
      }
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Limite taille des requêtes
  app.use(require('express').json({ limit: '10mb' }));
  app.use(require('express').urlencoded({ extended: true, limit: '10mb' }));

  // Validation globale des DTOs
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  // Préfixe API
  app.setGlobalPrefix('api');

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Passidoc API')
    .setDescription('API de la plateforme de gestion des dossiers AFYM')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Passidoc API démarrée sur : http://localhost:${process.env.PORT ?? 3000}/api`);
  console.log(`Swagger disponible sur : http://localhost:${process.env.PORT ?? 3000}/api/docs`);
}
bootstrap();
