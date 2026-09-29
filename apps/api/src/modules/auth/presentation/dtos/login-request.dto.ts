import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const LoginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export class LoginRequestDto extends createZodDto(LoginRequestSchema) {}
