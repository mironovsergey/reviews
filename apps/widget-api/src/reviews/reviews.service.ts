import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { Review, ReviewDocument, ReviewFilter, ReviewTarget } from '@reviews/database';
import { decodeCursor, encodeCursor } from './cursor';
import type { ListReviewsQueryDto } from './dto/list-reviews-query.dto';
import type { ListReviewsResponseDto, ReviewResponseDto } from './dto/review-response.dto';

const DEFAULT_LIMIT = 12;

/** Лента отзывов виджета. */
@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private readonly reviewModel: Model<Review>,
    @InjectModel(ReviewTarget.name) private readonly targetModel: Model<ReviewTarget>,
  ) {}

  /**
   * Возвращает страницу ленты и положение для следующего запроса.
   *
   * Порядок задается парой «дата публикации, идентификатор»: даты хранятся
   * с точностью до суток, и одного поля недостаточно для устойчивого
   * перехода между страницами.
   *
   * Условия вывода принимаются отдельным доводом, а не читаются здесь: их
   * уже загрузило опознание кабинета. Отбор ими выполняется при чтении, и
   * страница может оказаться короче предела при непустом `nextCursor` -
   * признаком конца ленты служит только он.
   */
  async list(
    workspaceId: Types.ObjectId,
    reviewFilter: ReviewFilter,
    query: ListReviewsQueryDto,
  ): Promise<ListReviewsResponseDto> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const filter: QueryFilter<Review> = { workspaceId };

    if (reviewFilter.minRating !== null) {
      filter.rating = { $gte: reviewFilter.minRating };
    }

    const hidden = await this.hiddenTargetIds(workspaceId);

    if (query.targetId !== undefined) {
      const targetId = new Types.ObjectId(query.targetId);

      // Лента, ограниченная снятой с вывода целью, пуста, и обращение к
      // отзывам не требуется.
      if (hidden.some((id) => id.equals(targetId))) {
        return { items: [], nextCursor: null };
      }

      filter.targetId = targetId;
    } else if (hidden.length > 0) {
      filter.targetId = { $nin: hidden };
    }

    if (query.cursor !== undefined) {
      const { publishedAt, id } = decodeCursor(query.cursor);

      // Дата хранится с точностью до суток, поэтому сравнение идет по обоим
      // полям пары сортировки.
      filter.$or = [{ publishedAt: { $lt: publishedAt } }, { publishedAt, _id: { $lt: id } }];
    }

    // Запрашивается на одну запись больше предела: так наличие продолжения
    // определяется без отдельного подсчета.
    const documents = await this.reviewModel
      .find(filter)
      .sort({ publishedAt: -1, _id: -1 })
      .limit(limit + 1);

    const hasMore = documents.length > limit;
    const items = hasMore ? documents.slice(0, limit) : documents;
    const last = items.at(-1);

    return {
      items: await this.toResponses(items),
      nextCursor: hasMore && last !== undefined ? encodeCursor(last.publishedAt, last._id) : null,
    };
  }

  /**
   * Идентификаторы целей, снятых с вывода.
   *
   * Флаг хранится только у цели и в отзыве не дублируется: иначе отключение
   * одной клиники требовало бы переписать все ее отзывы, а переключать флаг
   * пришлось бы в двух местах сразу.
   *
   * Перечень запрашивается при каждом обращении к ленте. Отключенных целей в
   * кабинете единицы или нет вовсе, а запрос обслуживает частичный индекс,
   * содержащий только их.
   */
  private async hiddenTargetIds(workspaceId: Types.ObjectId): Promise<Types.ObjectId[]> {
    const hidden = await this.targetModel.find({ workspaceId, isActive: false }).select('_id');

    return hidden.map((target) => target._id);
  }

  /** Подписи целей приходят отдельным запросом: в отзыве хранится только ссылка. */
  private async toResponses(reviews: ReviewDocument[]): Promise<ReviewResponseDto[]> {
    const ids = [
      ...new Map(reviews.map((review) => [review.targetId.toString(), review.targetId])).values(),
    ];
    const targets = await this.targetModel.find({ _id: { $in: ids } });
    const byId = new Map(targets.map((target) => [target._id.toString(), target]));

    return reviews.map((review) => {
      // Цель отсутствует, если ее запись удалена синхронизацией.
      const target = byId.get(review.targetId.toString());

      return {
        id: review._id.toString(),
        authorName: review.authorName,
        rating: review.rating,
        text: review.text,
        publishedAt: review.publishedAt.toISOString(),
        source: review.source,
        answer: review.answer,
        originUrl: review.originUrl,
        target: {
          id: review.targetId.toString(),
          kind: review.targetKind,
          name: target?.name ?? '',
          specialty: target?.specialty ?? null,
        },
      };
    });
  }
}
