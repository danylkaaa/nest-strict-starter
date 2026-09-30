import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const GreetingResponseSchema = z.object({ message: z.string() });

export class GreetingResponseDto extends createZodDto(GreetingResponseSchema) {}
