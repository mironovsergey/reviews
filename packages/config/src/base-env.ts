import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, registerDecorator, type ValidationOptions } from 'class-validator';

const MIN_PORT = 1;
const MAX_PORT = 65535;

/**
 * Поле с номером TCP-порта.
 *
 * Имя переменной у каждой службы свое: файл .env в рабочем пространстве один
 * на всех, и общий PORT заставлял бы службы занимать один и тот же порт.
 *
 * Проверка выполняется одним правилом: набор из отдельных условий на тип,
 * нижнюю и верхнюю границы давал бы три сообщения об одной ошибке.
 */
export const IsTcpPort = (name: string, options?: ValidationOptions): PropertyDecorator => {
  return (target: object, propertyName: string | symbol): void => {
    Type(() => Number)(target, propertyName);

    registerDecorator({
      name: 'isTcpPort',
      target: target.constructor,
      propertyName: propertyName.toString(),
      options,
      validator: {
        validate: (value: unknown): boolean =>
          typeof value === 'number' &&
          Number.isInteger(value) &&
          value >= MIN_PORT &&
          value <= MAX_PORT,
        defaultMessage: (): string =>
          `${name}: требуется номер порта от ${MIN_PORT} до ${MAX_PORT}`,
      },
    });
  };
};

/** Переменные, необходимые любому приложению с доступом к базе. */
export class DatabaseEnv {
  @IsString({ message: 'MONGODB_URI: адрес базы должен быть строкой' })
  @IsNotEmpty({ message: 'MONGODB_URI: адрес базы обязателен' })
  MONGODB_URI: string;
}
