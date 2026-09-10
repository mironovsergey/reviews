import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { SignUpDto } from './sign-up.dto';

/**
 * Повторяет порядок работы ValidationPipe: сначала преобразование значений,
 * затем проверки. Именно этот порядок определяет, получит ли клиент отказ 400
 * или запрос дойдет до схемы Mongoose и обернется отказом 500.
 */
const check = async (
  payload: Record<string, unknown>,
): Promise<{ dto: SignUpDto; invalid: string[] }> => {
  const dto = plainToInstance(SignUpDto, payload);
  const errors = await validate(dto);

  return { dto, invalid: errors.map((error) => error.property) };
};

const VALID = { email: 'user@example.com', password: 'password123', name: 'Пётр' };

describe('данные регистрации', () => {
  it('обрезает пробелы вокруг имени', async () => {
    const { dto, invalid } = await check({ ...VALID, name: '  Пётр  ' });

    expect(invalid).toEqual([]);
    expect(dto.name).toBe('Пётр');
  });

  it('отвергает имя из одних пробелов', async () => {
    const { invalid } = await check({ ...VALID, name: '   ' });

    expect(invalid).toEqual(['name']);
  });

  it('обрезает пробелы вокруг названия кабинета', async () => {
    const { dto, invalid } = await check({ ...VALID, workspaceName: '  Доктор Плюс  ' });

    expect(invalid).toEqual([]);
    expect(dto.workspaceName).toBe('Доктор Плюс');
  });

  it('отвергает название кабинета из одних пробелов', async () => {
    const { invalid } = await check({ ...VALID, workspaceName: '   ' });

    expect(invalid).toEqual(['workspaceName']);
  });

  it('не требует названия кабинета', async () => {
    const { invalid } = await check(VALID);

    expect(invalid).toEqual([]);
  });

  it('оставляет нестроковое имя проверке типа', async () => {
    const { invalid } = await check({ ...VALID, name: 42 });

    expect(invalid).toEqual(['name']);
  });
});
