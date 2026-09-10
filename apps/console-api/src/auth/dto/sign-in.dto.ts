import { IsEmail, IsString, MaxLength } from 'class-validator';

/** Учетные данные для входа в консоль. */
export class SignInDto {
  @IsEmail({}, { message: 'Укажите корректный адрес электронной почты' })
  @MaxLength(254, { message: 'Адрес электронной почты слишком длинный' })
  email: string;

  @IsString({ message: 'Пароль должен быть строкой' })
  @MaxLength(128, { message: 'Пароль должен содержать не более 128 символов' })
  password: string;
}
