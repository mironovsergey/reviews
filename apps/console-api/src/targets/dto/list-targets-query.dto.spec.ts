import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ListTargetsQueryDto } from './list-targets-query.dto';

/** Повторяет порядок работы ValidationPipe: преобразование, затем проверки. */
const invalidProperties = async (query: Record<string, unknown>): Promise<string[]> => {
  const errors = await validate(plainToInstance(ListTargetsQueryDto, query));

  return errors.map((error) => error.property);
};

describe('условия отбора целей', () => {
  it.each(['clinic', 'doctor'])('принимает вид %s', async (kind) => {
    expect(await invalidProperties({ kind })).toEqual([]);
  });

  it('требует вид цели', async () => {
    expect(await invalidProperties({})).toEqual(['kind']);
  });

  it('отвергает неизвестный вид', async () => {
    expect(await invalidProperties({ kind: 'nurse' })).toEqual(['kind']);
  });
});
