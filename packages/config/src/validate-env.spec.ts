import { describe, expect, it } from 'vitest';
import { IsString } from 'class-validator';
import { DatabaseEnv, IsTcpPort } from './base-env';
import { DecodesToBytes, validateEnv } from './validate-env';

const KEY = Buffer.alloc(32, 7).toString('base64');

class TestEnv extends DatabaseEnv {
  @IsTcpPort('SERVICE_PORT')
  SERVICE_PORT: number;

  @IsString({ message: 'SECRET: требуется строка' })
  SECRET: string;

  @DecodesToBytes(32, { message: 'KEY: ключ должен раскодироваться в 32 байт' })
  KEY: string;
}

const valid = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  MONGODB_URI: 'mongodb://localhost:27017/reviews',
  SERVICE_PORT: '3010',
  SECRET: 'value',
  KEY,
  ...overrides,
});

describe('разбор окружения', () => {
  it('приводит порт к числу', () => {
    expect(validateEnv(TestEnv, valid()).SERVICE_PORT).toBe(3010);
  });

  it('отбрасывает окружающие пробелы', () => {
    const config = validateEnv(TestEnv, valid({ SECRET: '  value  ' }));

    expect(config.SECRET).toBe('value');
  });

  it('не спотыкается о посторонние переменные окружения', () => {
    const config = validateEnv(TestEnv, valid({ PATH: '/usr/bin', HOME: '/root' }));

    expect(config.MONGODB_URI).toBe('mongodb://localhost:27017/reviews');
  });
});

describe('проверка окружения', () => {
  it('сообщает обо всех проблемах сразу', () => {
    const validate = (): unknown => validateEnv(TestEnv, { SERVICE_PORT: '70000' });

    expect(validate).toThrow('SERVICE_PORT');
    expect(validate).toThrow('MONGODB_URI');
    expect(validate).toThrow('SECRET');
    expect(validate).toThrow('KEY');
  });

  it.each([
    ['адрес базы не задан', { MONGODB_URI: '   ' }, /MONGODB_URI: адрес базы обязателен/u],
    ['порт не задан', { SERVICE_PORT: '' }, /SERVICE_PORT: требуется номер порта от 1 до 65535/u],
    [
      'порт вне диапазона',
      { SERVICE_PORT: '70000' },
      /SERVICE_PORT: требуется номер порта от 1 до 65535/u,
    ],
    [
      'порт нецелый',
      { SERVICE_PORT: '3010.5' },
      /SERVICE_PORT: требуется номер порта от 1 до 65535/u,
    ],
    [
      'порт не число',
      { SERVICE_PORT: 'abc' },
      /SERVICE_PORT: требуется номер порта от 1 до 65535/u,
    ],
    [
      'ключ иной длины',
      { KEY: Buffer.alloc(16).toString('base64') },
      /KEY: ключ должен раскодироваться в 32 байт/u,
    ],
  ])('отвергает окружение, если %s', (_name, overrides, message) => {
    expect(() => validateEnv(TestEnv, valid(overrides))).toThrow(message);
  });
});
