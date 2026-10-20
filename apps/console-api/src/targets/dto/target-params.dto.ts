import { IsMongoId } from 'class-validator';

/** Параметры пути, указывающие на клинику или врача. */
export class TargetParamsDto {
  @IsMongoId({ message: 'Недопустимый идентификатор клиники или врача' })
  id: string;
}
