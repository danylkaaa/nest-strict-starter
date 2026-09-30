import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const GreetingQuerySchema = z.object({ name: z.string() });

export class GreetingQueryDto extends createZodDto(GreetingQuerySchema) {}
