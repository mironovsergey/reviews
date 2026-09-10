import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Обрезает окружающие пробелы до проверок.
 *
 * Нестроковое значение возвращается без изменений: его отвергает IsString, а
 * обращение к методам строки здесь привело бы к отказу 500 вместо 400.
 */
const trimmed = () =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

/** Данные регистрации пользователя вместе с кабинетом. */
export class SignUpDto {
  @IsEmail({}, { message: 'Укажите корректный адрес электронной почты' })
  @MaxLength(254, { message: 'Адрес электронной почты слишком длинный' })
  email: string;

  @IsString({ message: 'Пароль должен быть строкой' })
  @MinLength(8, { message: 'Пароль должен содержать не менее 8 символов' })
  @MaxLength(128, { message: 'Пароль должен содержать не более 128 символов' })
  password: string;

  /**
   * Значение обрезается до проверки длины: имя из одних пробелов не проходит
   * MinLength, тогда как без обрезки оно доходило бы до схемы Mongoose и
   * отвергалось уже там, приводя к отказу 500.
   */
  @trimmed()
  @IsString({ message: 'Имя должно быть строкой' })
  @MinLength(1, { message: 'Укажите имя' })
  @MaxLength(120, { message: 'Имя должно содержать не более 120 символов' })
  name: string;

  /** Название кабинета; при отсутствии применяется имя пользователя. */
  @trimmed()
  @IsOptional()
  @IsString({ message: 'Название кабинета должно быть строкой' })
  @MinLength(1, { message: 'Укажите название кабинета' })
  @MaxLength(120, { message: 'Название кабинета должно содержать не более 120 символов' })
  workspaceName?: string;
}
