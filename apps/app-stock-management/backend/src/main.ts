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
      'http://localhost:5204',
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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('재고관리 API')
    .setDescription('AMA 재고관리 앱 Backend API')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addTag('health', '서버 상태')
    .addTag('auth', '인증')
    .addTag('corporations', '법인 관리')
    .addTag('users', '사용자 관리')
    .addTag('applications', '사용 신청')
    .addTag('products', '상품(SPU) 관리')
    .addTag('skus', 'SKU 관리')
    .addTag('transactions', '입출고 관리')
    .addTag('inventories', '재고 현황')
    .addTag('receiving-schedules', '입고예정')
    .addTag('sales-orders', '판매주문')
    .addTag('order-batches', '발주 제안')
    .addTag('forecasts', '수요 예측')
    .addTag('safety-stocks', '안전재고')
    .addTag('settings', '설정')
    .addTag('dashboard', '대시보드')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3104;
  await app.listen(port);
  console.log(`Stock Management API running on port ${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
