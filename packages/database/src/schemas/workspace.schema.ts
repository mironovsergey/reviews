import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/** Границы шкалы оценок агрегатора. */
const MIN_RATING = 1;
const MAX_RATING = 5;

/**
 * Условия вывода отзывов в виджете.
 *
 * Условия относятся к показу, а не к данным: в базе хранится все, что отдал
 * агрегатор, а отбор выполняется при чтении ленты. Поэтому смена условия
 * действует немедленно и обратима, тогда как отбор при загрузке потребовал
 * бы повторной синхронизации и не вернул бы уже удаленное.
 *
 * Набор условий закрытый: каждое из них - отдельное поле с собственной
 * проверкой. Универсальные правила вида «поле, оператор, значение» дали бы
 * консоли составлять произвольные запросы к базе, что пришлось бы отдельно
 * ограничивать.
 */
@Schema({ _id: false })
export class ReviewFilter {
  /** Наименьшая оценка, при которой отзыв выводится; null - без ограничения. */
  @Prop({ type: Number, default: null, min: MIN_RATING, max: MAX_RATING })
  minRating: number | null;
}

export const ReviewFilterSchema = SchemaFactory.createForClass(ReviewFilter);

/** Кабинет клиента: владелец данных и настроек виджета. */
@Schema({ timestamps: true, collection: 'workspaces' })
export class Workspace {
  /** Название кабинета; отображается в консоли. */
  @Prop({ required: true, trim: true })
  name: string;

  /** Публичный ключ, подставляемый в код вставки виджета. */
  @Prop({ required: true, unique: true })
  apiKey: string;

  /** Домены, которым разрешено размещение виджета. Пустой список запрещает все. */
  @Prop({ type: [String], default: [] })
  allowedDomains: string[];

  /** Отключенный кабинет не обслуживает запросы виджета. */
  @Prop({ default: true })
  isActive: boolean;

  /**
   * Условия вывода отзывов.
   *
   * Хранятся в кабинете, а не отдельной коллекцией: опознание виджета уже
   * загружает эту запись на каждый запрос, поэтому условия достаются без
   * второго обращения к базе.
   */
  @Prop({ type: ReviewFilterSchema, default: () => ({}) })
  reviewFilter: ReviewFilter;
}

export type WorkspaceDocument = HydratedDocument<Workspace>;

export const WorkspaceSchema = SchemaFactory.createForClass(Workspace);
