/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { GrpcExceptionFilter } from './filters/grpc-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api/v1';
  app.setGlobalPrefix(globalPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true
    })
  );
  app.useGlobalFilters(new GrpcExceptionFilter());

  app.enableCors(
    {
      origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:8081',
        '*',
      ],
      methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
      credentials: true,
    }
  );

   const config = new DocumentBuilder()
    .setTitle('TourApp API')
    .setDescription('API for career seekers and mentors platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/v1', app, document);

  const port = process.env.PORT || 3400;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
}

bootstrap();
