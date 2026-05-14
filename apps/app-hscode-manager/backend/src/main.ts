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
      'http://localhost:5202',
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
    .setTitle('HS Code Manager API')
    .setDescription('AMA HS코드 매니저 앱 Backend API')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addTag('health', '서버 상태')
    .addTag('import-countries', '수입국 마스터')
    .addTag('export-countries', '수출국 마스터')
    .addTag('exporters', '수출업체 마스터')
    .addTag('fta-matrix', 'FTA 협정세율 매트릭스')
    .addTag('inquiries', '문의 관리')
    .addTag('items', '품목(원부자재) 마스터')
    .addTag('intake', '입력 채널 (직접/엑셀/바코드)')
    .addTag('matching', '정규화·매칭·AI 추천')
    .addTag('classifications', '분류 컨펌·영속화')
    .addTag('verifications', '사후 검증 이벤트')
    .addTag('expert-reviews', '전문가 크로스체크')
    .addTag('admin', '관리·정책·KPI')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3102;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`HS Code Manager API running on port ${port}`);
  // eslint-disable-next-line no-console
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
