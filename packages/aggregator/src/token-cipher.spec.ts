import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { TokenCipher } from './token-cipher';

/** Ключ AES-256; пригодность ключа проверяет окружение, здесь он произвольный. */
const key = (): string => randomBytes(32).toString('base64');

describe('шифрование токена', () => {
  it('восстанавливает исходное значение', () => {
    const cipher = new TokenCipher(key());
    const token = 'eyJhbGciOiJIUzI1NiJ9.полезная-нагрузка.подпись';

    expect(cipher.decrypt(cipher.encrypt(token))).toBe(token);
  });

  it('сохраняет значение с символами вне ASCII', () => {
    const cipher = new TokenCipher(key());

    expect(cipher.decrypt(cipher.encrypt('токен «ёж»'))).toBe('токен «ёж»');
  });

  it('порождает новый вектор инициализации на каждый вызов', () => {
    const cipher = new TokenCipher(key());
    const first = cipher.encrypt('token');
    const second = cipher.encrypt('token');

    // Повторное использование вектора в режиме GCM раскрывает открытый текст.
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it('не расшифровывает подмененный шифротекст', () => {
    const cipher = new TokenCipher(key());
    const value = cipher.encrypt('token');
    const tampered = Buffer.from(value.ciphertext, 'base64');
    tampered[0] ^= 0xff;

    expect(() =>
      cipher.decrypt({ ...value, ciphertext: tampered.toString('base64') }),
    ).toThrowError();
  });

  it('не расшифровывает при подмененном теге аутентификации', () => {
    const cipher = new TokenCipher(key());
    const value = cipher.encrypt('token');
    const tampered = Buffer.from(value.authTag, 'base64');
    tampered[0] ^= 0xff;

    expect(() => cipher.decrypt({ ...value, authTag: tampered.toString('base64') })).toThrowError();
  });

  it('не расшифровывает чужим ключом', () => {
    const value = new TokenCipher(key()).encrypt('token');

    expect(() => new TokenCipher(key()).decrypt(value)).toThrowError();
  });
});
