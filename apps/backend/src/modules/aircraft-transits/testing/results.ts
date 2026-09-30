import type { Result } from 'neverthrow';

export const unwrap = <T, E>(result: Result<T, E>): T =>
  result.match(
    (value) => value,
    (error) => {
      throw new Error(`Expected an ok result, received ${String(error)}`);
    },
  );

export const unwrapError = <T, E>(result: Result<T, E>): E =>
  result.match(
    (value) => {
      throw new Error(`Expected an error result, received ${JSON.stringify(value)}`);
    },
    (error) => error,
  );
