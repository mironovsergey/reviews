import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

/**
 * Хеширование паролей консоли.
 *
 * Алгоритм не задается явно: @node-rs/argon2 объявляет перечисление
 * Algorithm как ambient const enum, несовместимый с isolatedModules. По
 * умолчанию библиотека применяет Argon2id, что закреплено проверкой формата
 * хеша в password.service.spec.ts.
 */
@Injectable()
export class PasswordService {
  /** Возвращает хеш пароля вместе с солью и параметрами алгоритма. */
  hash(plaintext: string): Promise<string> {
    return hash(plaintext);
  }

  /** Сверяет пароль с сохраненным хешем. */
  async verify(hashed: string, plaintext: string): Promise<boolean> {
    try {
      return await verify(hashed, plaintext);
    } catch {
      // Хеш поврежден или имеет посторонний формат: пароль считается неверным.
      return false;
    }
  }
}
