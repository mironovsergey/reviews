import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ReviewTarget, ReviewTargetKind } from './review-target.schema';
import { Workspace } from './workspace.schema';

/** Площадка, с которой получен отзыв. */
export const ReviewSource = {
  Yandex: 'yandex',
  Google: 'google',
  TwoGis: '2gis',
  Zoon: 'zoon',
  Yell: 'yell',
  MyReviews: 'myreviews',
  ProDoctorov: 'prodoctorov',
  Flamp: 'flamp',
  Hosters: 'hosters',
  Otzovik: 'otzovik',
  HostingsInfo: 'hostings-info',
  YandexServices: 'yandex-services',
  Avito: 'avito',
  NaPopravku: 'na-popravku',
  YandexBusiness: 'yandex-business',
  SberZdorovie: 'sberzdorovie',
  TBank: 'tbank',
  Vk: 'vk',
  Trustpilot: 'trustpilot',
  Hosting101: 'hosting101',
  IRecommend: 'irecommend',
  Perekrestok: 'perekrestok',
  Metro: 'metro',
  Magnit: 'magnit',
  Lenta: 'lenta',
  Kuper: 'kuper',
  ProDoctorovDoctors: 'prodoctorov-doctors',
  MySpar: 'my-spar',
  Other: 'other',
} as const;

export type ReviewSource = (typeof ReviewSource)[keyof typeof ReviewSource];

/** Отзыв, загруженный от агрегатора и отдаваемый виджету. */
@Schema({ timestamps: true, collection: 'reviews' })
export class Review {
  @Prop({ type: Types.ObjectId, ref: Workspace.name, required: true })
  workspaceId: Types.ObjectId;

  /** Клиника или врач, к которому относится отзыв. */
  @Prop({ type: Types.ObjectId, ref: ReviewTarget.name, required: true })
  targetId: Types.ObjectId;

  /** Денормализовано из цели отзыва: избавляет виджет от отдельного запроса. */
  @Prop({ type: String, enum: Object.values(ReviewTargetKind), required: true })
  targetKind: ReviewTargetKind;

  /** Идентификатор отзыва у агрегатора. */
  @Prop({ required: true })
  sourceId: number;

  @Prop({ type: String, enum: Object.values(ReviewSource), required: true })
  source: ReviewSource;

  /** Исходный код `service` от агрегатора; служит для опознания новых площадок. */
  @Prop({ required: true })
  sourceCode: number;

  @Prop({ required: true, trim: true })
  authorName: string;

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ required: true })
  text: string;

  /** Ответ клиники на отзыв при его наличии. */
  @Prop({ type: String, default: null })
  answer: string | null;

  /** Ссылка на отзыв на исходной площадке. */
  @Prop({ type: String, default: null })
  originUrl: string | null;

  /**
   * Дата публикации. У агрегатора время отсутствует, поэтому хранится
   * полночь UTC: значение участвует в сортировке ленты и в курсоре, и не
   * должно зависеть от часового пояса сервера.
   */
  @Prop({ required: true })
  publishedAt: Date;

  /**
   * Отметка прогона синхронизации. Отзывы, не обновленные текущим прогоном,
   * считаются исчезнувшими у агрегатора и удаляются.
   */
  @Prop({ required: true })
  syncedAt: Date;
}

export type ReviewDocument = HydratedDocument<Review>;

export const ReviewSchema = SchemaFactory.createForClass(Review);

/** Уникальность отзыва в кабинете; по этой паре синхронизация выполняет upsert. */
ReviewSchema.index({ workspaceId: 1, sourceId: 1 }, { unique: true });

/**
 * Лента виджета без фильтра. Идентификатор входит в ключ вторым полем
 * сортировки: даты хранятся с точностью до суток, и без него порядок
 * отзывов одного дня не был бы устойчивым между страницами.
 */
ReviewSchema.index({ workspaceId: 1, publishedAt: -1, _id: -1 });

/** Лента, отфильтрованная по одной клинике или одному врачу. */
ReviewSchema.index({ workspaceId: 1, targetId: 1, publishedAt: -1, _id: -1 });
