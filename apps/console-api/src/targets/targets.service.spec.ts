import { Aggregate, model, Query, Types, type PipelineStage } from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Review,
  ReviewSchema,
  ReviewTarget,
  ReviewTargetKind,
  ReviewTargetSchema,
} from '@reviews/database';
import { TargetsService } from './targets.service';

const WORKSPACE_ID = new Types.ObjectId();

/**
 * Настоящие модели без подключения к базе.
 *
 * Запросы и конвейеры строит сам Mongoose, а перехватывается только их
 * выполнение. Поэтому проверяется фактически собранный запрос, а служба
 * получает модели без приведения типов.
 */
const targetModel = model(ReviewTarget.name, ReviewTargetSchema);
const reviewModel = model(Review.name, ReviewSchema);

/** Запись цели в том виде, в каком она лежит в базе. */
const storedTarget = (fields: Record<string, unknown> = {}): Record<string, unknown> => ({
  _id: new Types.ObjectId(),
  workspaceId: WORKSPACE_ID,
  externalId: 101,
  externalUuid: 'external-uuid',
  kind: ReviewTargetKind.Doctor,
  name: 'Иванова Мария',
  nameWords: ['иванова', 'мария'],
  specialty: 'Терапевт',
  isActive: true,
  ...fields,
});

/** Строка подсчета отзывов, которую возвращает конвейер. */
const countRow = (target: Record<string, unknown>, count: number): Record<string, unknown> => ({
  _id: target._id,
  count,
});

/**
 * Перехватывает выполнение запросов и собирает их для проверки.
 *
 * Запрос целей получает записи, восстановленные с учетом его проекции, как
 * при чтении из базы, вместе со значениями по умолчанию. Конвейер подсчета
 * получает заданные строки.
 */
const intercept = (
  targets: Record<string, unknown>[],
  counts: Record<string, unknown>[] = [],
): { queries: Query<unknown, unknown>[]; pipelines: PipelineStage[][] } => {
  const queries: Query<unknown, unknown>[] = [];
  const pipelines: PipelineStage[][] = [];

  vi.spyOn(Query.prototype, 'exec').mockImplementation(function (this: Query<unknown, unknown>) {
    queries.push(this);

    // MongoDB возвращает _id при любой проекции, если он не исключен явно,
    // тогда как hydrate отбрасывает его, когда проекция о нем не упоминает.
    const projection = this.projection();
    const selected = projection === null ? null : { _id: 1, ...projection };

    return Promise.resolve(targets.map((raw) => targetModel.hydrate(raw, selected)));
  });

  vi.spyOn(Aggregate.prototype, 'exec').mockImplementation(function (this: Aggregate<unknown>) {
    pipelines.push(this.pipeline());

    return Promise.resolve(counts);
  });

  return { queries, pipelines };
};

const service = new TargetsService(targetModel, reviewModel);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('перечень целей', () => {
  it('отбирает цели кабинета заданного вида', async () => {
    const { queries } = intercept([storedTarget()]);

    await service.list(WORKSPACE_ID, ReviewTargetKind.Doctor);

    expect(queries[0]?.getFilter()).toEqual({
      workspaceId: WORKSPACE_ID,
      kind: ReviewTargetKind.Doctor,
    });
  });

  it('упорядочивает цели по имени', async () => {
    const { queries } = intercept([storedTarget()]);

    await service.list(WORKSPACE_ID, ReviewTargetKind.Doctor);

    expect(queries[0]?.getOptions().sort).toEqual({ name: 1 });
  });

  it('возвращает вид, имя, специальность, флаг вывода и число отзывов', async () => {
    const target = storedTarget();

    intercept([target], [countRow(target, 7)]);

    expect(await service.list(WORKSPACE_ID, ReviewTargetKind.Doctor)).toEqual([
      {
        id: String(target._id),
        kind: ReviewTargetKind.Doctor,
        name: 'Иванова Мария',
        specialty: 'Терапевт',
        isActive: true,
        reviewsCount: 7,
      },
    ]);
  });

  it('не добавляет в ответ служебных полей хранилища', async () => {
    intercept([storedTarget()]);

    const [row] = await service.list(WORKSPACE_ID, ReviewTargetKind.Doctor);

    expect(Object.keys(row ?? {}).sort()).toEqual(
      ['id', 'isActive', 'kind', 'name', 'reviewsCount', 'specialty'].sort(),
    );
  });

  it('сообщает о цели, снятой с вывода', async () => {
    intercept([storedTarget({ isActive: false })]);

    const [row] = await service.list(WORKSPACE_ID, ReviewTargetKind.Doctor);

    expect(row?.isActive).toBe(false);
  });

  it('считает выводимой цель, созданную до появления флага', async () => {
    const target = storedTarget();

    delete target.isActive;
    intercept([target]);

    const [row] = await service.list(WORKSPACE_ID, ReviewTargetKind.Doctor);

    expect(row?.isActive).toBe(true);
  });

  it('возвращает null вместо специальности клиники', async () => {
    intercept([storedTarget({ kind: ReviewTargetKind.Clinic, name: 'Клиника', specialty: null })]);

    const [row] = await service.list(WORKSPACE_ID, ReviewTargetKind.Clinic);

    expect(row?.specialty).toBeNull();
  });
});

describe('подсчет отзывов', () => {
  it('считает отзывы одним запросом по кабинету и найденным целям', async () => {
    const first = storedTarget();
    const second = storedTarget({ name: 'Петров Олег' });
    const { pipelines } = intercept([first, second]);

    await service.list(WORKSPACE_ID, ReviewTargetKind.Doctor);

    expect(pipelines).toHaveLength(1);
    expect(pipelines[0]?.[0]).toEqual({
      $match: { workspaceId: WORKSPACE_ID, targetId: { $in: [first._id, second._id] } },
    });
  });

  it('ставит ноль цели без отзывов', async () => {
    const reviewed = storedTarget();
    const silent = storedTarget({ name: 'Петров Олег' });

    intercept([reviewed, silent], [countRow(reviewed, 3)]);

    const rows = await service.list(WORKSPACE_ID, ReviewTargetKind.Doctor);

    expect(rows.map((row) => row.reviewsCount)).toEqual([3, 0]);
  });

  it('не обращается к отзывам, если целей нет', async () => {
    const { pipelines } = intercept([]);

    expect(await service.list(WORKSPACE_ID, ReviewTargetKind.Doctor)).toEqual([]);
    expect(pipelines).toHaveLength(0);
  });
});
