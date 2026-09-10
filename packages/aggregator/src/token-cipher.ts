import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

/** Шифротекст вместе с вектором инициализации и тегом аутентификации, все в base64. */
export interface EncryptedValue {
  ciphertext: string;
  iv: string;
  authTag: string;
}

/**
 * Шифрование токенов агрегатора перед записью в базу.
 *
 * Режим GCM выбран ради аутентификации: шифротекст, подмененный в обход
 * приложения, не расшифровывается молча, а приводит к ошибке.
 */
export class TokenCipher {
  private readonly key: Buffer;

  /** Пригодность ключа проверяется при старте приложения, здесь он только раскодируется. */
  constructor(encodedKey: string) {
    this.key = Buffer.from(encodedKey, 'base64');
  }

  /** Шифрует значение, порождая новый вектор инициализации. */
  encrypt(plaintext: string): EncryptedValue {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
    };
  }

  /**
   * Восстанавливает исходное значение.
   *
   * Несовпадение тега аутентификации приводит к исключению: подмененный или
   * поврежденный шифротекст не превращается в мусорную строку.
   */
  decrypt(value: EncryptedValue): string {
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(value.iv, 'base64'));

    decipher.setAuthTag(Buffer.from(value.authTag, 'base64'));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(value.ciphertext, 'base64')),
      decipher.final(),
    ]);

    return plaintext.toString('utf8');
  }
}
