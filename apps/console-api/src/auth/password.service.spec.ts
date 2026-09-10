import { describe, expect, it } from 'vitest';
import { PasswordService } from './password.service';

/**
 * Разбор строки хеша PHC: `$argon2id$v=19$m=...,t=...,p=...$соль$хеш`.
 * Первое поле называет алгоритм.
 */
const ALGORITHM_FIELD = 1;

const service = new PasswordService();

describe('хеширование пароля', () => {
  it('применяет Argon2id', async () => {
    // Алгоритм не задается явно и остается на усмотрение библиотеки, поэтому
    // закреплен здесь: Argon2i и Argon2d к паролям неприменимы.
    const hashed = await service.hash('secret-password');

    expect(hashed.split('$')[ALGORITHM_FIELD]).toBe('argon2id');
  });

  it('порождает разные хеши для одного пароля', async () => {
    const [first, second] = await Promise.all([service.hash('secret'), service.hash('secret')]);

    // Соль случайна, поэтому по совпадению хешей нельзя узнать, что у двух
    // учетных записей одинаковый пароль.
    expect(first).not.toBe(second);
  });

  it('не содержит открытого пароля', async () => {
    const hashed = await service.hash('secret-password');

    expect(hashed).not.toContain('secret-password');
  });
});

describe('сверка пароля', () => {
  it('подтверждает верный пароль', async () => {
    const hashed = await service.hash('secret-password');

    await expect(service.verify(hashed, 'secret-password')).resolves.toBe(true);
  });

  it('отвергает неверный пароль', async () => {
    const hashed = await service.hash('secret-password');

    await expect(service.verify(hashed, 'secret-passwore')).resolves.toBe(false);
  });

  it('различает регистр', async () => {
    const hashed = await service.hash('Secret');

    await expect(service.verify(hashed, 'secret')).resolves.toBe(false);
  });

  it('сохраняет пароль с символами вне ASCII', async () => {
    const hashed = await service.hash('пароль-«ёж»');

    await expect(service.verify(hashed, 'пароль-«ёж»')).resolves.toBe(true);
  });

  it('считает неверным пароль при поврежденном хеше', async () => {
    // Посторонний формат приходит из базы, испорченной вручную либо
    // заполненной прежней версией приложения: исключение наружу не выпускается.
    await expect(service.verify('не-хеш', 'secret')).resolves.toBe(false);
    await expect(service.verify('', 'secret')).resolves.toBe(false);
  });
});
