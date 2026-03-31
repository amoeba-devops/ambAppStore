import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'https://ama.amoeba.site',
      'https://apps.amoeba.site',
      'https://stg-ama.amoeba.site',
      'https://stg-apps.amoeba.site',
      'http://localhost:5201',
    ],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api/v1');

  // Swagger 설정
  const swaggerConfig = new DocumentBuilder()
    .setTitle('법인차량관리 API')
    .setDescription('AMA 법인차량관리 앱 Backend API')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addTag('health', '서버 상태')
    .addTag('vehicles', '차량 관리')
    .addTag('drivers', '운전자 관리')
    .addTag('dispatches', '배차 관리')
    .addTag('trip-logs', '운행일지')
    .addTag('maintenance', '정비 관리')
    .addTag('monitor', '대시보드/모니터링')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3101;
  await app.listen(port);
  console.log(`Car Manager API running on port ${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
