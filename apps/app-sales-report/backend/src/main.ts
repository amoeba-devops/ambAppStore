import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'https://ama.amoeba.site',
      'https://stg-ama.amoeba.site',
      'https://apps.amoeba.site',
      'https://stg-apps.amoeba.site',
      'http://localhost:5203',
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
    .setTitle('매출리포트 API')
    .setDescription('SB Data & Reporting System Backend API')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addTag('health', '서버 상태')
    .addTag('auth', '인증')
    .addTag('spu-masters', 'SPU 마스터 관리')
    .addTag('sku-masters', 'SKU 마스터 관리')
    .addTag('channel-masters', '채널 마스터')
    .addTag('channel-product-mappings', '채널 상품 매핑')
    .addTag('sku-cost-histories', '원가 변경 이력')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3103;
  await app.listen(port);
  console.log(`[DRD] Sales Report Backend running on port ${port}`);
}
bootstrap();
