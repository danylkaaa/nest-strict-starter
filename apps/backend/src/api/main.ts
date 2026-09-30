import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { ApiConfig } from '@/api/core/config/api.config';
import { setupSwagger } from '@/api/core/swagger/swagger.config.js';

import { AppModule } from './api.module.js';
import { formatStartupBanner } from './core/logger/startup-banner.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // buffer logs until Logger is ready
  });
  const logger = app.get(Logger);
  app.useLogger(logger);

  app.enableShutdownHooks();
  app.setGlobalPrefix('api');
  setupSwagger(app);

  const {
    NODE_ENV,
    http: { port: PORT },
  } = app.get(ApiConfig);
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
