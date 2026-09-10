import { Model, Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { modelQuery } from '@reviews/testing';
import { ReviewTarget, ReviewTargetDocument, ReviewTargetKind } from '@reviews/database';
import { TargetsService } from './targets.service';

const WORKSPACE_ID = new Types.ObjectId();
const TARGET_ID = new Types.ObjectId();

/**
 * Основа отбора: цели кабинета, не снятые с вывода. Условие задано через
 * «не равно false», поэтому записи без флага остаются в выдаче.
 */
const ACTIVE_IN_WORKSPACE = { workspaceId: WORKSPACE_ID, isActive: { $ne: false } };

/** Матчер Vitest объявлен как any и сохраняется отдельным значением. */
const containing = (fields: Record<string, unknown>): unknown => expect.objectContaining(fields);

const target = (overrides: Partial<ReviewTarget> = {}): ReviewTargetDocument =>
  ({
    _id: TARGET_ID,
    workspaceId: WORKSPACE_ID,
    externalId: 7,
    externalUuid: 'uuid',
    kind: ReviewTargetKind.Doctor,
    name: 'Петров-Водкин Пётр',
    nameWords: ['петров', 'водкин', 'пётр'],
    specialty: 'Терапевт',
    ...overrides,
  }) as ReviewTargetDocument;

const build = (targets: ReviewTargetDocument[] = [target()]) => {
  const targetModel = { find: modelQuery(targets) };

  return {
    service: new TargetsService(targetModel as unknown as Model<ReviewTarget>),
    targetModel,
  };
};

describe('перечень целей', () => {
  it('возвращает вид, имя и специальность', async () => {
    const { service } = build();

    await expect(service.list(WORKSPACE_ID, {})).resolves.toEqual([
      {
        id: TARGET_ID.toString(),
        kind: ReviewTargetKind.Doctor,
        name: 'Петров-Водкин Пётр',
        specialty: 'Терапевт',
      },
    ]);
  });

  it('не добавляет в ответ служебных полей хранилища', async () => {
    const { service } = build();

    const [item] = await service.list(WORKSPACE_ID, {});

    expect(item).not.toHaveProperty('nameWords');
    expect(item).not.toHaveProperty('externalId');
  });

  it('ограничивает выборку кабинетом', async () => {
    const { service, targetModel } = build();

    await service.list(WORKSPACE_ID, {});

    expect(targetModel.find).toHaveBeenCalledWith(ACTIVE_IN_WORKSPACE);
  });

  it('добавляет отбор по виду цели', async () => {
    const { service, targetModel } = build();

    await service.list(WORKSPACE_ID, { kind: ReviewTargetKind.Clinic });

    expect(targetModel.find).toHaveBeenCalledWith({
      ...ACTIVE_IN_WORKSPACE,
      kind: ReviewTargetKind.Clinic,
    });
  });
});

describe('снятие цели с вывода', () => {
  it('не выводит отключенные цели', async () => {
    const { service, targetModel } = build();

    await service.list(WORKSPACE_ID, {});

    expect(targetModel.find).toHaveBeenCalledWith(containing({ isActive: { $ne: false } }));
  });

  it('оставляет в выдаче записи без флага', async () => {
    // Цели, созданные до появления поля, флага не имеют: равенство true
    // молча убрало бы их из виджета.
    const { service } = build([target()]);

    await expect(service.list(WORKSPACE_ID, {})).resolves.toHaveLength(1);
  });
});

describe('поиск по имени', () => {
  it('требует совпадения начала слова для каждого слова запроса', async () => {
    const { service, targetModel } = build();

    await service.list(WORKSPACE_ID, { search: 'петр вод' });

    expect(targetModel.find).toHaveBeenCalledWith({
      ...ACTIVE_IN_WORKSPACE,
      $and: [{ nameWords: /^петр/u }, { nameWords: /^вод/u }],
    });
  });

  it('пропускает запрос из одних пробелов', async () => {
    const { service, targetModel } = build();

    await service.list(WORKSPACE_ID, { search: '   ' });

    expect(targetModel.find).toHaveBeenCalledWith(ACTIVE_IN_WORKSPACE);
  });
});
