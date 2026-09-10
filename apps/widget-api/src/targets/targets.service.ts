import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import type { ListTargetsQueryDto } from './dto/list-targets-query.dto';
import type { TargetResponseDto } from './dto/target-response.dto';
import { ReviewTarget, toNamePrefixPatterns } from '@reviews/database';

const DEFAULT_LIMIT = 50;

/** Клиники и врачи: перечень целей, о которых оставляют отзывы. */
@Injectable()
export class TargetsService {
  constructor(@InjectModel(ReviewTarget.name) private readonly targetModel: Model<ReviewTarget>) {}

  /**
   * Возвращает цели кабинета для фильтра виджета.
   *
   * Отбирается только то, что нужно списку: вид, имя и специальность.
   */
  async list(
    workspaceId: Types.ObjectId,
    query: ListTargetsQueryDto,
  ): Promise<TargetResponseDto[]> {
    // Условие «не отключена», а не «отключена равно false»: записи, созданные
    // до появления поля, флага не имеют, и равенство убрало бы их из выдачи.
    const filter: QueryFilter<ReviewTarget> = { workspaceId, isActive: { $ne: false } };

    if (query.kind !== undefined) {
      filter.kind = query.kind;
    }

    if (query.search !== undefined) {
      const patterns = toNamePrefixPatterns(query.search);

      // Запрос из одних пробелов фильтром не считается.
      if (patterns.length > 0) {
        filter.$and = patterns.map((pattern) => ({ nameWords: pattern }));
      }
    }

    const targets = await this.targetModel
      .find(filter)
      .select('kind name specialty')
      .sort({ name: 1 })
      .limit(query.limit ?? DEFAULT_LIMIT);

    return targets.map((target) => ({
      id: target._id.toString(),
      kind: target.kind,
      name: target.name,
      specialty: target.specialty,
    }));
  }
}
