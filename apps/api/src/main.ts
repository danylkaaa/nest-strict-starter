import { NestFactory } from '@nestjs/core'
import { Logger } from 'nestjs-pino'

import { AppConfig } from '@/app/config/app-config.js'

import { AppModule } from './app.module.js'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  app.useLogger(app.get(Logger))
  await app.listen(app.get(AppConfig).port)
}

await bootstrap()
