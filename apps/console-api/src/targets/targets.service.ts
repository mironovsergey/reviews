import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Review,
  ReviewTarget,
  ReviewTargetKind,
  type ReviewTargetDocument,
} from '@reviews/database';
import type { TargetResponseDto } from './dto/target-response.dto';
import type { UpdateTargetDto } from './dto/update-target.dto';

/** Поля цели, из которых собирается строка таблицы. */
const TARGET_FIELDS = 'kind name specialty isActive';

/** Строка подсчета отзывов: идентификатор цели и число ее отзывов. */
interface ReviewCountRow {
  _id: Types.ObjectId;
  count: number;
}

/** Клиники и врачи кабинета для таблиц консоли. */
@Injectable()
export class TargetsService {
  constructor(
    @InjectModel(ReviewTarget.name) private readonly targetModel: Model<ReviewTarget>,
    @InjectModel(Review.name) private readonly reviewModel: Model<Review>,
  ) {}

  /**
   * Возвращает все цели кабинета одного вида, упорядоченные по имени.
   *
   * Перечень выдается целиком: в кабинете десятки клиник и врачей, и
   * постраничный вывод усложнил бы поиск, не дав выигрыша в объеме ответа.
   */
  async list(workspaceId: Types.ObjectId, kind: ReviewTargetKind): Promise<TargetResponseDto[]> {
    const targets = await this.targetModel
      .find({ workspaceId, kind })
      .select(TARGET_FIELDS)
      .sort({ name: 1 });

    const counts = await this.countReviews(
      workspaceId,
      targets.map((target) => target._id),
    );

    return targets.map((target) => this.toResponse(target, counts));
  }

  /**
   * Изменяет флаг вывода цели и возвращает ее строку таблицы.
   *
   * Кабинет входит в условие отбора: чужая цель неотличима от
   * несуществующей, и ответ в обоих случаях одинаков.
   *
   * Синхронизация флаг не перезаписывает: прогон выставляет его только при
   * создании записи. Виджет учитывает изменение с ближайшего обращения.
   */
  async update(
    workspaceId: Types.ObjectId,
    targetId: string,
    dto: UpdateTargetDto,
  ): Promise<TargetResponseDto> {
    const target = await this.targetModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(targetId), workspaceId },
        { $set: { isActive: dto.isActive } },
        { returnDocument: 'after' },
      )
      .select(TARGET_FIELDS);

    if (target === null) {
      throw new NotFoundException('Клиника или врач не найдены');
    }

    return this.toResponse(target, await this.countReviews(workspaceId, [target._id]));
  }

  /**
   * Подсчитывает отзывы перечисленных целей одним запросом.
   *
   * Условие на кабинет и цели совпадает с началом индекса ленты по цели, а
   * группировка обращается только к targetId, поэтому подсчет выполняется по
   * индексу без чтения самих отзывов.
   *
   * Конвейер агрегации не приводит значения к типам схемы, поэтому условия
   * передаются в виде ObjectId, а не строк.
   */
  private async countReviews(
    workspaceId: Types.ObjectId,
    targetIds: Types.ObjectId[],
  ): Promise<Map<string, number>> {
    if (targetIds.length === 0) {
      return new Map();
    }

    const rows = await this.reviewModel.aggregate<ReviewCountRow>([
      { $match: { workspaceId, targetId: { $in: targetIds } } },
      { $group: { _id: '$targetId', count: { $sum: 1 } } },
    ]);

    return new Map(rows.map((row) => [row._id.toString(), row.count]));
  }

  /** Поля перечислены явно: служебные поля хранилища в ответ не попадают. */
  private toResponse(target: ReviewTargetDocument, counts: Map<string, number>): TargetResponseDto {
    return {
      id: target._id.toString(),
      kind: target.kind,
      name: target.name,
      specialty: target.specialty,
      isActive: target.isActive,
      reviewsCount: counts.get(target._id.toString()) ?? 0,
    };
  }
}
