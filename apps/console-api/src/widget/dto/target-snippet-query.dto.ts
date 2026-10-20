import { IsMongoId } from 'class-validator';

/** Клиника или врач, для страницы которых выдается код вставки. */
export class TargetSnippetQueryDto {
  @IsMongoId({ message: 'Недопустимый идентификатор клиники или врача' })
  targetId: string;
}
