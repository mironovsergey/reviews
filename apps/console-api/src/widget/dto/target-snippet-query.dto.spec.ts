import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { TargetSnippetQueryDto } from './target-snippet-query.dto';

/** Повторяет порядок работы ValidationPipe: преобразование, затем проверки. */
const invalidProperties = async (query: Record<string, unknown>): Promise<string[]> => {
  const errors = await validate(plainToInstance(TargetSnippetQueryDto, query));

  return errors.map((error) => error.property);
};

describe('запрос кода вставки для цели', () => {
  it('принимает идентификатор записи', async () => {
    expect(await invalidProperties({ targetId: '507f1f77bcf86cd799439011' })).toEqual([]);
  });

  it('требует идентификатор цели', async () => {
    expect(await invalidProperties({})).toEqual(['targetId']);
  });

  it('отвергает строку, не являющуюся идентификатором', async () => {
    expect(await invalidProperties({ targetId: 'doctor-1' })).toEqual(['targetId']);
  });
});
