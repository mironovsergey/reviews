import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Review, ReviewTarget, ReviewTargetKind } from '@reviews/database';
import type { TargetResponseDto } from './dto/target-response.dto';

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
      .select('kind name specialty isActive')
      .sort({ name: 1 });

    const counts = await this.countReviews(
      workspaceId,
      targets.map((target) => target._id),
    );

    return targets.map((target) => ({
      id: target._id.toString(),
      kind: target.kind,
      name: target.name,
      specialty: target.specialty,
      isActive: target.isActive,
      reviewsCount: counts.get(target._id.toString()) ?? 0,
    }));
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
}
