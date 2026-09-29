import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

// Shape and format only; business rules (e.g. "name must not be blank") live in the domain.
export const GreetingQuerySchema = z.object({ name: z.string().default('world') })

export class GreetingQueryDto extends createZodDto(GreetingQuerySchema) {}
