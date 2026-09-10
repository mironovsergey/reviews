import { plainToInstance } from 'class-transformer';
import {
  registerDecorator,
  validateSync,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

/**
 * Проверяет, что строка в base64 разворачивается в заданное число байт.
 *
 * Готовой проверки в class-validator нет: IsBase64 подтверждает только
 * кодировку, тогда как алгоритму шифрования нужен ключ точной длины.
 */
export const DecodesToBytes = (bytes: number, options?: ValidationOptions): PropertyDecorator => {
  return (target: object, propertyName: string | symbol): void => {
    registerDecorator({
      name: 'decodesToBytes',
      target: target.constructor,
      propertyName: propertyName.toString(),
      constraints: [bytes],
      options,
      validator: {
        validate: (value: unknown): boolean =>
          typeof value === 'string' && Buffer.from(value, 'base64').length === bytes,
        defaultMessage: (args?: ValidationArguments): string =>
          `${args?.property ?? 'значение'}: ключ должен раскодироваться в ${bytes} байт`,
      },
    });
  };
};

/**
 * Проверяет окружение при старте приложения.
 *
 * Каждое приложение объявляет собственный класс переменных и передает его
 * сюда: наборы отличаются, а порядок разбора и вид сообщений общие.
 *
 * Проблемы сообщаются одним исключением целиком: при развертывании важно
 * увидеть весь список сразу, а не исправлять переменные по одной.
 */
export const validateEnv = <T extends object>(
  schema: new () => T,
  raw: Record<string, unknown>,
): T => {
  // Значения из файла .env обрезает dotenv, но переменные окружения приходят
  // как есть, и случайный пробел сделал бы адрес базы негодным.
  //
  // Пустое значение равнозначно незаданной переменной: docker compose
  // подставляет пустую строку вместо переменной, отсутствующей в .env, и
  // запуск должен останавливаться так же, как при ее отсутствии.
  const provided = Object.entries(raw)
    .map(([key, value]): [string, unknown] => [
      key,
      typeof value === 'string' ? value.trim() : value,
    ])
    .filter(([, value]) => value !== '');

  const config = plainToInstance(schema, Object.fromEntries(provided));
  const errors = validateSync(config, { skipMissingProperties: false });

  if (errors.length > 0) {
    const problems = errors.flatMap((error) => Object.values(error.constraints ?? {}));

    throw new Error(`Непригодное окружение:\n${problems.map((line) => `  - ${line}`).join('\n')}`);
  }

  return config;
};
