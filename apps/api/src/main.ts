import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppConfig } from '@/app/config/app-config.js';
import { formatStartupBanner } from '@/app/logger/startup-banner.js';

import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // buffer logs until Logger is ready
  });
  const logger = app.get(Logger);
  app.useLogger(logger);

  app.setGlobalPrefix('api');

  const { NODE_ENV, PORT } = app.get(AppConfig);
  await app.listen(PORT);

  const baseUrl = await app.getUrl();
  logger.log(
    formatStartupBanner([
      {
        rows: [
          ['Environment', NODE_ENV],
          ['Address', baseUrl],
          ['Port', String(PORT)],
          ['Node', process.version],
        ],
      },
      {
        rows: [
          ['- App', baseUrl],
          ['- Health', `${baseUrl}/api/health`],
        ],
      },
    ]),
    'Bootstrap',
  );
}

await bootstrap();
