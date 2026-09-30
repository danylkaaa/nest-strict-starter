import { createZodDto } from 'nestjs-zod';

import { TransitJobPayloadSchema } from '@/modules/aircraft-transits/aircraft-transit.js';

import { createJobSchema } from './create-job.schema.js';

export const CreateAircraftReportJobSchema = createJobSchema(TransitJobPayloadSchema);

export class CreateAircraftReportJobDto extends createZodDto(CreateAircraftReportJobSchema) {}
