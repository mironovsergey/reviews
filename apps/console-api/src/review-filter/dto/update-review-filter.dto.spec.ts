import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UpdateReviewFilterDto } from './update-review-filter.dto';

/** Повторяет порядок работы ValidationPipe: преобразование, затем проверки. */
const check = async (
  payload: Record<string, unknown>,
): Promise<{ dto: UpdateReviewFilterDto; invalid: string[] }> => {
  const dto = plainToInstance(UpdateReviewFilterDto, payload);
  const errors = await validate(dto);

  return { dto, invalid: errors.map((error) => error.property) };
};

describe('изменение условий вывода', () => {
  it.each([1, 3, 5])('принимает оценку %i', async (minRating) => {
    const { dto, invalid } = await check({ minRating });

    expect(invalid).toEqual([]);
    expect(dto.minRating).toBe(minRating);
  });

  it('принимает null: он снимает ограничение', async () => {
    const { dto, invalid } = await check({ minRating: null });

    expect(invalid).toEqual([]);
    expect(dto.minRating).toBeNull();
  });

  it('допускает отсутствие поля: условие остается прежним', async () => {
    const { dto, invalid } = await check({});

    expect(invalid).toEqual([]);
    expect(dto.minRating).toBeUndefined();
  });

  it.each([0, 6])('отвергает оценку %i вне шкалы', async (minRating) => {
    expect((await check({ minRating })).invalid).toEqual(['minRating']);
  });

  it('отвергает дробную оценку', async () => {
    expect((await check({ minRating: 3.5 })).invalid).toEqual(['minRating']);
  });

  it('отвергает оценку, переданную строкой', async () => {
    expect((await check({ minRating: '3' })).invalid).toEqual(['minRating']);
  });
});
