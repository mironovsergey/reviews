import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Workspace } from './workspace.schema';

/** Вид цели отзыва. */
export const ReviewTargetKind = {
  Clinic: 'clinic',
  Doctor: 'doctor',
} as const;

export type ReviewTargetKind = (typeof ReviewTargetKind)[keyof typeof ReviewTargetKind];

/** Клиника или врач: предмет отзывов, загружаемый от агрегатора. */
@Schema({ timestamps: true, collection: 'review_targets' })
export class ReviewTarget {
  @Prop({ type: Types.ObjectId, ref: Workspace.name, required: true })
  workspaceId: Types.ObjectId;

  /**
   * Идентификатор организации у агрегатора; клиники и врачи имеют общее
   * пространство идентификаторов.
   */
  @Prop({ required: true })
  externalId: number;

  /** Тот же объект у агрегатора в виде UUID; сохраняется для сверки. */
  @Prop({ required: true })
  externalUuid: string;

  @Prop({ type: String, enum: Object.values(ReviewTargetKind), required: true })
  kind: ReviewTargetKind;

  @Prop({ required: true, trim: true })
  name: string;

  /** Нормализованные слова `name`: обеспечивают префиксный поиск по multikey-индексу. */
  @Prop({ type: [String], default: [] })
  nameWords: string[];

  /** Поле `product_category` от агрегатора; заполнено у врачей. */
  @Prop({ type: String, default: null })
  specialty: string | null;

  /**
   * Цель снята с вывода в виджете.
   *
   * Значение задается кабинетом и не относится к данным агрегатора, поэтому
   * синхронизация его не трогает: прогон выставляет флаг только при создании
   * записи, через `$setOnInsert`.
   *
   * Запросы виджета отбирают цели условием «не отключена», а не «отключена
   * равно false»: записи, созданные до появления поля, флага не имеют, и
   * равенство молча убрало бы их из выдачи.
   */
  @Prop({ default: true })
  isActive: boolean;
}

export type ReviewTargetDocument = HydratedDocument<ReviewTarget>;

export const ReviewTargetSchema = SchemaFactory.createForClass(ReviewTarget);

/** Уникальность цели в кабинете; по этой паре синхронизация выполняет upsert. */
ReviewTargetSchema.index({ workspaceId: 1, externalId: 1 }, { unique: true });

/** Список клиник в виджете: выборка по kind с сортировкой по имени. */
ReviewTargetSchema.index({ workspaceId: 1, kind: 1, name: 1 });

/** Поиск врача: multikey по nameWords; запрос выполняется шаблонами с якорем. */
ReviewTargetSchema.index({ workspaceId: 1, kind: 1, nameWords: 1 });

/**
 * Цели, снятые с вывода. Лента виджета исключает их отзывы и потому
 * запрашивает этот перечень при каждом обращении.
 *
 * Индекс частичный: он содержит только отключенные записи, которых в
 * кабинете единицы или нет вовсе, поэтому обходится почти бесплатно и по
 * объему, и по стоимости записи. Условие запроса `isActive: false` совпадает
 * с условием индекса, иначе он не был бы применен.
 */
ReviewTargetSchema.index({ workspaceId: 1 }, { partialFilterExpression: { isActive: false } });
