import { createZodDto } from 'nestjs-zod';

import { WebhookContentSchema } from '@/modules/webhooks/webhook.js';

import { createJobSchema } from './create-job.schema.js';

export const CreateWebhookJobSchema = createJobSchema(WebhookContentSchema);

export class CreateWebhookJobDto extends createZodDto(CreateWebhookJobSchema) {}
