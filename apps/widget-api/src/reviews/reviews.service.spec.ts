import { BadRequestException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import {
  Review,
  ReviewDocument,
  ReviewFilter,
  ReviewSource,
  ReviewTarget,
  ReviewTargetDocument,
  ReviewTargetKind,
} from '@reviews/database';
import { modelQuery, queryResult } from '@reviews/testing';
import { encodeCursor } from './cursor';
import { ReviewsService } from './reviews.service';

const WORKSPACE_ID = new Types.ObjectId();
const TARGET_ID = new Types.ObjectId();
const PUBLISHED_AT = new Date('2026-08-01T00:00:00.000Z');

/** Условия вывода не заданы: лента отдает все отзывы кабинета. */
const NO_FILTER: ReviewFilter = { minRating: null };

const review = (overrides: Partial<Review> & { _id?: Types.ObjectId } = {}): ReviewDocument =>
  ({
    _id: new Types.ObjectId(),
    workspaceId: WORKSPACE_ID,
    targetId: TARGET_ID,
    targetKind: ReviewTargetKind.Doctor,
    sourceId: 1,
    source: ReviewSource.Yandex,
    sourceCode: 1,
    authorName: 'Пациент',
    rating: 5,
    text: 'Спасибо',
    answer: null,
    originUrl: null,
    publishedAt: PUBLISHED_AT,
    syncedAt: PUBLISHED_AT,
    ...overrides,
  }) as ReviewDocument;

const target = (overrides: Partial<ReviewTarget> = {}): ReviewTargetDocument =>
  ({
    _id: TARGET_ID,
    workspaceId: WORKSPACE_ID,
    externalId: 7,
    externalUuid: 'uuid',
    kind: ReviewTargetKind.Doctor,
    name: 'Петров Пётр',
    nameWords: ['петров', 'пётр'],
    specialty: 'Терапевт',
    ...overrides,
  }) as ReviewTargetDocument;

/**
 * Модель целей отвечает на два разных запроса ленты: сначала о снятых с
 * вывода целях, затем о подписях к найденным отзывам. Подстановка различает
 * их по условию запроса, а не по порядку вызовов.
 */
const build = (
  options: {
    reviews?: ReviewDocument[];
    targets?: ReviewTargetDocument[];
    hidden?: ReviewTargetDocument[];
  } = {},
) => {
  const reviewModel = { find: modelQuery(options.reviews ?? [review()]) };
  const targetModel = {
    find: vi.fn((filter: { isActive?: unknown; _id?: unknown }) =>
      filter.isActive === false
        ? queryResult(options.hidden ?? [])
        : queryResult(options.targets ?? [target()]),
    ),
  };

  return {
    service: new ReviewsService(
      reviewModel as unknown as Model<Review>,
      targetModel as unknown as Model<ReviewTarget>,
    ),
    reviewModel,
    targetModel,
  };
};

describe('лента отзывов', () => {
  it('соединяет отзыв с его целью', async () => {
    const { service } = build();

    const page = await service.list(WORKSPACE_ID, NO_FILTER, {});

    expect(page.items[0]?.target).toMatchObject({ name: 'Петров Пётр', specialty: 'Терапевт' });
  });

  it('не теряет отзыв, если запись цели отсутствует', async () => {
    const { service } = build({ targets: [] });

    const page = await service.list(WORKSPACE_ID, NO_FILTER, {});

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.target).toMatchObject({ name: '', specialty: null });
  });

  it('запрашивает подписи целей одним обращением без повторов', async () => {
    const { service, targetModel } = build({ reviews: [review(), review(), review()] });

    await service.list(WORKSPACE_ID, NO_FILTER, {});

    // Отзывов три, цель у них общая: подписи запрашиваются одним обращением с
    // одним идентификатором, а не по обращению на отзыв.
    const labelCalls = targetModel.find.mock.calls.filter(([filter]) => filter._id !== undefined);

    expect(labelCalls).toHaveLength(1);
    expect(targetModel.find).toHaveBeenCalledWith({ _id: { $in: [TARGET_ID] } });
  });

  it('выводит дату публикации в формате ISO 8601', async () => {
    const { service } = build();

    const page = await service.list(WORKSPACE_ID, NO_FILTER, {});

    expect(page.items[0]?.publishedAt).toBe('2026-08-01T00:00:00.000Z');
  });

  it('не добавляет в ответ служебных полей хранилища', async () => {
    const { service } = build();

    const page = await service.list(WORKSPACE_ID, NO_FILTER, {});

    expect(page.items[0]).not.toHaveProperty('workspaceId');
    expect(page.items[0]).not.toHaveProperty('syncedAt');
  });

  it('сохраняет ответ клиники и ссылку на площадку', async () => {
    const { service } = build({
      reviews: [review({ answer: 'Благодарим', originUrl: 'https://example.ru/1' })],
    });

    const page = await service.list(WORKSPACE_ID, NO_FILTER, {});

    expect(page.items[0]).toMatchObject({
      answer: 'Благодарим',
      originUrl: 'https://example.ru/1',
    });
  });
});

describe('постраничность', () => {
  it('не выдает курсор на последней странице', async () => {
    const { service } = build({ reviews: [review()] });

    await expect(service.list(WORKSPACE_ID, NO_FILTER, { limit: 12 })).resolves.toMatchObject({
      nextCursor: null,
    });
  });

  it('выдает курсор последнего отзыва, когда есть продолжение', async () => {
    const first = review();
    const second = review();
    const { service } = build({ reviews: [first, second] });

    const page = await service.list(WORKSPACE_ID, NO_FILTER, { limit: 1 });

    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBe(encodeCursor(first.publishedAt, first._id));
  });

  it('разбирает курсор запроса в положение ленты', async () => {
    const { service, reviewModel } = build();
    const cursor = encodeCursor(PUBLISHED_AT, TARGET_ID);

    await service.list(WORKSPACE_ID, NO_FILTER, { cursor });

    expect(reviewModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: [
          { publishedAt: { $lt: PUBLISHED_AT } },
          { publishedAt: PUBLISHED_AT, _id: { $lt: TARGET_ID } },
        ],
      }),
    );
  });

  it('отвергает поврежденный курсор', async () => {
    const { service } = build();

    await expect(
      service.list(WORKSPACE_ID, NO_FILTER, { cursor: 'сломанный' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('передает в запрос цель из фильтра', async () => {
    const { service, reviewModel } = build();

    await service.list(WORKSPACE_ID, NO_FILTER, { targetId: TARGET_ID.toString() });

    expect(reviewModel.find).toHaveBeenCalledWith(expect.objectContaining({ targetId: TARGET_ID }));
  });
});

describe('цели, снятые с вывода', () => {
  const HIDDEN_ID = new Types.ObjectId();

  /** Отключенная цель с собственным идентификатором. */
  const hiddenTarget = (): ReviewTargetDocument => {
    const hidden = target({ isActive: false });
    hidden._id = HIDDEN_ID;

    return hidden;
  };

  it('запрашивает только отключенные цели кабинета', async () => {
    const { service, targetModel } = build();

    await service.list(WORKSPACE_ID, NO_FILTER, {});

    expect(targetModel.find).toHaveBeenCalledWith({ workspaceId: WORKSPACE_ID, isActive: false });
  });

  it('исключает из ленты отзывы отключенной цели', async () => {
    const { service, reviewModel } = build({ hidden: [hiddenTarget()] });

    await service.list(WORKSPACE_ID, NO_FILTER, {});

    expect(reviewModel.find).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      targetId: { $nin: [HIDDEN_ID] },
    });
  });

  it('не добавляет условия, когда отключенных целей нет', async () => {
    const { service, reviewModel } = build();

    await service.list(WORKSPACE_ID, NO_FILTER, {});

    // Точное совпадение: лишнего условия по цели в запросе нет.
    expect(reviewModel.find).toHaveBeenCalledWith({ workspaceId: WORKSPACE_ID });
  });

  it('отдает пустую ленту, если запрошена отключенная цель', async () => {
    const { service, reviewModel } = build({ hidden: [hiddenTarget()] });

    await expect(
      service.list(WORKSPACE_ID, NO_FILTER, { targetId: HIDDEN_ID.toString() }),
    ).resolves.toEqual({
      items: [],
      nextCursor: null,
    });

    // Обращение к отзывам не требуется: выдача заведомо пуста.
    expect(reviewModel.find).not.toHaveBeenCalled();
  });

  it('оставляет отбор по цели, если она не отключена', async () => {
    const { service, reviewModel } = build();

    await service.list(WORKSPACE_ID, NO_FILTER, { targetId: TARGET_ID.toString() });

    expect(reviewModel.find).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      targetId: TARGET_ID,
    });
  });
});

describe('условия вывода отзывов', () => {
  it('отбирает отзывы не ниже заданной оценки', async () => {
    const { service, reviewModel } = build();

    await service.list(WORKSPACE_ID, { minRating: 4 }, {});

    expect(reviewModel.find).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      rating: { $gte: 4 },
    });
  });

  it('не добавляет условия, когда предел не задан', async () => {
    const { service, reviewModel } = build();

    await service.list(WORKSPACE_ID, NO_FILTER, {});

    // Точное совпадение: лишнего условия по оценке в запросе нет.
    expect(reviewModel.find).toHaveBeenCalledWith({ workspaceId: WORKSPACE_ID });
  });

  it('сочетается с отбором по цели', async () => {
    const { service, reviewModel } = build();

    await service.list(WORKSPACE_ID, { minRating: 5 }, { targetId: TARGET_ID.toString() });

    expect(reviewModel.find).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      targetId: TARGET_ID,
      rating: { $gte: 5 },
    });
  });

  it('сочетается с исключением снятых с вывода целей', async () => {
    const hidden = target({ isActive: false });
    hidden._id = new Types.ObjectId();

    const { service, reviewModel } = build({ hidden: [hidden] });

    await service.list(WORKSPACE_ID, { minRating: 4 }, {});

    expect(reviewModel.find).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      targetId: { $nin: [hidden._id] },
      rating: { $gte: 4 },
    });
  });

  it('сочетается с положением в ленте', async () => {
    const { service, reviewModel } = build();
    const cursor = encodeCursor(PUBLISHED_AT, TARGET_ID);

    await service.list(WORKSPACE_ID, { minRating: 4 }, { cursor });

    // Условие по оценке применяется вместе с переходом к следующей странице,
    // а не вместо него.
    expect(reviewModel.find).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      rating: { $gte: 4 },
      $or: [
        { publishedAt: { $lt: PUBLISHED_AT } },
        { publishedAt: PUBLISHED_AT, _id: { $lt: TARGET_ID } },
      ],
    });
  });
});
