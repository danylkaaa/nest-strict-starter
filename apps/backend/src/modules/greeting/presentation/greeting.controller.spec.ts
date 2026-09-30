import { createMock } from '@golevelup/ts-vitest';
import { err, ok } from 'neverthrow';
import { describe, expect, it } from 'vitest';

import { GreetingService } from '@/modules/greeting/application/services/greeting.service.js';
import { GreetingNameEmptyError } from '@/modules/greeting/domain/greeting.errors.js';
import { GreetingController } from '@/modules/greeting/presentation/greeting.controller.js';

const controllerWith = (result: ReturnType<GreetingService['greet']>) =>
  new GreetingController(createMock<GreetingService>({ greet: () => result }));

describe('greeting controller', () => {
  it('returns the greeting as a response dto', () => {
    const controller = controllerWith(ok('Hello, Ada!'));

    expect(controller.greet({ name: 'Ada' })).toEqual(ok({ message: 'Hello, Ada!' }));
  });

  it('passes the query name to the service', () => {
    const service = createMock<GreetingService>({
      greet: () => ok<string, GreetingNameEmptyError>('Hello, Ada!'),
    });

    new GreetingController(service).greet({ name: 'Ada' });

    expect(service.greet).toHaveBeenCalledWith('Ada');
  });

  it('maps a domain error to a 400 with its name and friendly message', () => {
    const controller = controllerWith(err(new GreetingNameEmptyError()));

    const result = controller.greet({ name: ' ' });

    expect(result.mapErr((error) => error.getStatus())).toEqual(err(400));
    expect(result.mapErr((error) => error.getResponse())).toEqual(
      err({ code: 'GreetingNameEmptyError', message: 'Please enter a name.' }),
    );
  });
});
