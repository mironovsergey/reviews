import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { TargetParamsDto } from './target-params.dto';
import { UpdateTargetDto } from './update-target.dto';

/** Повторяет порядок работы ValidationPipe: преобразование, затем проверки. */
const invalidProperties = async <T extends object>(
  dto: new () => T,
  payload: Record<string, unknown>,
): Promise<string[]> => {
  const errors = await validate(plainToInstance(dto, payload));

  return errors.map((error) => error.property);
};

describe('изменение цели', () => {
  it.each([true, false])('принимает признак вывода %s', async (isActive) => {
    expect(await invalidProperties(UpdateTargetDto, { isActive })).toEqual([]);
  });

  it('требует признак вывода', async () => {
    expect(await invalidProperties(UpdateTargetDto, {})).toEqual(['isActive']);
  });

  it.each(['false', 0, null])('отвергает значение %j вместо логического', async (isActive) => {
    expect(await invalidProperties(UpdateTargetDto, { isActive })).toEqual(['isActive']);
  });
});

describe('идентификатор цели в пути', () => {
  it('принимает идентификатор записи', async () => {
    expect(await invalidProperties(TargetParamsDto, { id: '507f1f77bcf86cd799439011' })).toEqual(
      [],
    );
  });

  it('отвергает строку, не являющуюся идентификатором', async () => {
    expect(await invalidProperties(TargetParamsDto, { id: 'clinic-1' })).toEqual(['id']);
  });
});
