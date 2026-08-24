import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import { PrismaService } from './utils/prisma/prisma.service';

const MAX_BODY_BYTES = 8 * 1024 * 1024 * 1024;

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';

  const fastifyAdapter = new FastifyAdapter({
    bodyLimit: MAX_BODY_BYTES,
    keepAliveTimeout: 620_000,
    connectionTimeout: 0,
    logger: {
      level: isProduction ? 'warn' : 'info',
    },
    disableRequestLogging: isProduction,
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyAdapter,
    {
      rawBody: true,
    },
  );

  await app.register(multipart, {
    attachFieldsToBody: 'keyValues',
    onFile: async (part) => {
      const buffer = await part.toBuffer();
      (part as any).value = {
        buffer,
        filename: part.filename,
        mimetype: part.mimetype,
        size: buffer.length,
        fieldname: part.fieldname,
      };
    },
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.register(fastifyHelmet, {
    contentSecurityPolicy: isProduction ? undefined : false,
  });

  await app.register(fastifyCookie);

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');

  console.log(
    `🚀 FashionConnect API running on: http://localhost:${port}/api/v1`,
  );

  const prismaService = app.get(PrismaService);
  await prismaService.connectDB();
}
bootstrap();
