import { SetMetadata } from '@nestjs/common';

export const JOB_HANDLER = Symbol('job-handler');
export const JobHandler = (queue: string): ClassDecorator => SetMetadata(JOB_HANDLER, queue);
