import type { ReviewFilter } from '@reviews/database';
import type { Request } from 'express';
import type { Types } from 'mongoose';

/** Кабинет, определенный по ключу виджета. */
export interface RequestWorkspace {
  id: Types.ObjectId;
  /** Условия вывода отзывов; достаются вместе с опознанием, без второго запроса. */
  reviewFilter: ReviewFilter;
}

export interface RequestWithWorkspace extends Request {
  workspace: RequestWorkspace;
}
