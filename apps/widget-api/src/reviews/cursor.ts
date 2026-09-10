import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

export interface CursorData {
  publishedAt: Date;
  id: Types.ObjectId;
}

interface CursorPayload {
  p: string;
  i: string;
}

const isCursorPayload = (value: unknown): value is CursorPayload =>
  typeof value === 'object' &&
  value !== null &&
  'p' in value &&
  typeof value.p === 'string' &&
  'i' in value &&
  typeof value.i === 'string';

export function encodeCursor(publishedAt: Date, id: Types.ObjectId): string {
  const payload: CursorPayload = { p: publishedAt.toISOString(), i: id.toString() };

  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): CursorData {
  let parsed: unknown;

  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    parsed = JSON.parse(json);
  } catch {
    throw new BadRequestException('Недопустимый курсор');
  }

  // JSON.parse возвращает любое валидное значение JSON, включая null и числа,
  // поэтому форму проверяем до обращения к полям.
  if (!isCursorPayload(parsed)) {
    throw new BadRequestException('Недопустимый курсор');
  }

  const publishedAt = new Date(parsed.p);
  const isCanonicalDate =
    !Number.isNaN(publishedAt.getTime()) && publishedAt.toISOString() === parsed.p;

  if (!isCanonicalDate || !Types.ObjectId.isValid(parsed.i)) {
    throw new BadRequestException('Недопустимый курсор');
  }

  const id = new Types.ObjectId(parsed.i);

  // ObjectId.isValid() принимает также любую строку из 12 символов, не
  // совпадающую с результатом encodeCursor.
  if (id.toString() !== parsed.i) {
    throw new BadRequestException('Недопустимый курсор');
  }

  return { publishedAt, id };
}
