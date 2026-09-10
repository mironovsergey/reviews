import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';

/** Новый список доменов, где разрешено размещение виджета. */
export class UpdateDomainsDto {
  /**
   * Домены, которым разрешено размещение виджета. Пустой список запрещает
   * показ повсюду.
   */
  @IsArray({ message: 'Домены должны передаваться списком' })
  @ArrayMaxSize(50, { message: 'Допускается не более 50 доменов' })
  @IsString({ each: true, message: 'Каждый домен должен быть строкой' })
  @MaxLength(253, { each: true, message: 'Домен должен содержать не более 253 символов' })
  domains: string[];
}
