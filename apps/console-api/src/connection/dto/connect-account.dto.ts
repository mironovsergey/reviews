import { IsEmail, IsString, MaxLength } from 'class-validator';

/**
 * Учетные данные кабинета агрегатора.
 *
 * Пароль применяется однократно для получения токена и нигде не сохраняется.
 */
export class ConnectAccountDto {
  @IsEmail({}, { message: 'Укажите корректный адрес электронной почты' })
  @MaxLength(254, { message: 'Адрес электронной почты слишком длинный' })
  email: string;

  @IsString({ message: 'Пароль должен быть строкой' })
  @MaxLength(256, { message: 'Пароль должен содержать не более 256 символов' })
  password: string;
}
