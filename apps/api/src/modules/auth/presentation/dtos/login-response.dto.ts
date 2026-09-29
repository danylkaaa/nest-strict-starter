import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number(),
  tokenType: z.literal('Bearer'),
});

export class LoginResponseDto extends createZodDto(LoginResponseSchema) {}
