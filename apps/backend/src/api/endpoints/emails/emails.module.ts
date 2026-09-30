import { Module } from '@nestjs/common';

import { EmailsModule } from '@/modules/emails/emails.module.js';

import { EmailsController } from './emails.controller.js';

@Module({ controllers: [EmailsController], imports: [EmailsModule] })
export class EmailsApiModule {}
