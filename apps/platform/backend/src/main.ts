import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'https://ama.amoeba.site',
      'https://stg-ama.amoeba.site',
      'https://apps.amoeba.site',
      'https://stg-apps.amoeba.site',
      'http://localhost:5200',
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

  const port = process.env.PORT || 3100;
  await app.listen(port);
  console.log(`Platform API running on port ${port}`);
}

bootstrap();
