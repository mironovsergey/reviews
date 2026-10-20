import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ReviewFilter, Workspace } from '@reviews/database';
import type { ReviewFilterResponseDto } from './dto/review-filter-response.dto';
import type { UpdateReviewFilterDto } from './dto/update-review-filter.dto';

/**
 * Изменения условий по путям вложенных полей записи кабинета.
 *
 * Тип выводится из схемы условий: новое поле схемы становится допустимым
 * ключом без правки этого объявления.
 */
type ReviewFilterChanges = Partial<{
  [Key in keyof ReviewFilter as `reviewFilter.${Key}`]: ReviewFilter[Key];
}>;

/**
 * Условия вывода отзывов в виджете.
 *
 * Условия хранятся в записи кабинета, а применяет их API виджета при чтении
 * ленты. Поэтому изменение действует с ближайшего обращения виджета и
 * повторной синхронизации не требует.
 */
@Injectable()
export class ReviewFilterService {
  constructor(@InjectModel(Workspace.name) private readonly workspaceModel: Model<Workspace>) {}

  /** Возвращает действующие условия кабинета. */
  async get(workspaceId: Types.ObjectId): Promise<ReviewFilterResponseDto> {
    const workspace = await this.workspaceModel.findById(workspaceId);

    if (workspace === null) {
      throw new NotFoundException('Кабинет не найден');
    }

    return this.toResponse(workspace.reviewFilter);
  }

  /**
   * Изменяет переданные условия, оставляя прочие без изменений.
   *
   * Запись выполняется по путям вложенных полей, а не заменой объекта
   * целиком: замена сбрасывала бы условия, о которых запрос не знает.
   */
  async update(
    workspaceId: Types.ObjectId,
    dto: UpdateReviewFilterDto,
  ): Promise<ReviewFilterResponseDto> {
    const changes = this.toChanges(dto);

    // Запрос без изменений допустим и равнозначен чтению.
    if (Object.keys(changes).length === 0) {
      return this.get(workspaceId);
    }

    const workspace = await this.workspaceModel.findOneAndUpdate(
      { _id: workspaceId },
      { $set: changes },
      { returnDocument: 'after' },
    );

    if (workspace === null) {
      throw new NotFoundException('Кабинет не найден');
    }

    return this.toResponse(workspace.reviewFilter);
  }

  /**
   * Переводит запрос в изменения записи.
   *
   * Отсутствующее поле не изменяется. Значение null передается как есть: оно
   * снимает условие.
   */
  private toChanges(dto: UpdateReviewFilterDto): ReviewFilterChanges {
    const changes: ReviewFilterChanges = {};

    if (dto.minRating !== undefined) {
      changes['reviewFilter.minRating'] = dto.minRating;
    }

    return changes;
  }

  /** Поля перечислены явно: служебные поля хранилища в ответ не попадают. */
  private toResponse(filter: ReviewFilter): ReviewFilterResponseDto {
    return { minRating: filter.minRating };
  }
}
