import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const MeResponseSchema = z.object({ email: z.string(), id: z.string() });

export class MeResponseDto extends createZodDto(MeResponseSchema) {}
