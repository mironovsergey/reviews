import { describe, expect, it } from 'vitest';
import {
  parseFirm,
  parseList,
  parseLoginToken,
  parseProfile,
  parseReview,
  parseTokenExpiry,
  unwrapPayload,
} from './parser';

/** Собирает JWT с заданной полезной нагрузкой; подпись не проверяется. */
const jwtWith = (payload: unknown): string => {
  const encode = (value: unknown): string =>
    Buffer.from(JSON.stringify(value)).toString('base64url');

  return `${encode({ alg: 'HS256' })}.${encode(payload)}.signature`;
};

const RAW_REVIEW = {
  id: 1,
  username: 'Пётр',
  date_create: '20.06.2026',
  rating: 5,
  message: 'Отлично',
  firm_id: 10,
  service: 1,
};

const RAW_FIRM = { id: 10, uuid: 'u-1', type: 1, name: 'Клиника' };

describe('снятие оболочки ответа', () => {
  it('достает данные из объекта с полем data', () => {
    expect(unwrapPayload({ status: 'ok', data: [1, 2] })).toEqual([1, 2]);
  });

  it('возвращает массив без изменений', () => {
    // GET /v1/review/index отдает массив без оболочки.
    expect(unwrapPayload([1, 2])).toEqual([1, 2]);
  });

  it('не принимает массив за объект с полем data', () => {
    expect(unwrapPayload(null)).toBeNull();
  });
});

describe('разбор отзыва', () => {
  it('принимает пригодную запись', () => {
    expect(parseReview(RAW_REVIEW)).toMatchObject({ id: 1, firm_id: 10, rating: 5 });
  });

  it('отвергает запись с полем неверного типа', () => {
    expect(parseReview({ ...RAW_REVIEW, rating: '5' })).toBeNull();
    expect(parseReview({ ...RAW_REVIEW, firm_id: '10' })).toBeNull();
  });

  it('отвергает то, что не является объектом', () => {
    expect(parseReview(null)).toBeNull();
    expect(parseReview([RAW_REVIEW])).toBeNull();
    expect(parseReview('отзыв')).toBeNull();
  });

  it('трактует отсутствие флагов как «не скрыт, не дубль»', () => {
    expect(parseReview(RAW_REVIEW)).toMatchObject({ hidden: false, is_double: false });
  });

  it('признает флаги только по значению true', () => {
    // Агрегатор передает и 1, и '1'; за скрытый принимается только true.
    expect(parseReview({ ...RAW_REVIEW, hidden: 1 })).toMatchObject({ hidden: false });
    expect(parseReview({ ...RAW_REVIEW, hidden: true })).toMatchObject({ hidden: true });
  });

  it('сводит пустой ответ и пустую ссылку к null', () => {
    const parsed = parseReview({ ...RAW_REVIEW, answer: '   ', url: '' });

    expect(parsed).toMatchObject({ answer: null, url: null });
  });
});

describe('разбор организации', () => {
  it('принимает пригодную запись', () => {
    expect(parseFirm(RAW_FIRM)).toEqual({
      id: 10,
      uuid: 'u-1',
      type: 1,
      name: 'Клиника',
      product_category: null,
    });
  });

  it('отвергает запись без обязательного поля', () => {
    expect(parseFirm({ ...RAW_FIRM, uuid: undefined })).toBeNull();
    expect(parseFirm({ ...RAW_FIRM, type: '1' })).toBeNull();
  });

  it('сохраняет специальность врача', () => {
    expect(parseFirm({ ...RAW_FIRM, product_category: 'Терапевт' })).toMatchObject({
      product_category: 'Терапевт',
    });
  });
});

describe('разбор профиля и токена входа', () => {
  it('принимает профиль с числовым идентификатором', () => {
    expect(parseProfile({ id: 7, email: 'clinic@example.com' })).toEqual({
      id: 7,
      email: 'clinic@example.com',
    });
  });

  it('отвергает профиль со строковым идентификатором', () => {
    expect(parseProfile({ id: '7', email: 'clinic@example.com' })).toBeNull();
  });

  it('достает токен из поля jwt', () => {
    expect(parseLoginToken({ jwt: 'token' })).toBe('token');
  });

  it('отвергает пустой токен', () => {
    expect(parseLoginToken({ jwt: '' })).toBeNull();
    expect(parseLoginToken({})).toBeNull();
  });
});

describe('срок действия токена', () => {
  it('переводит exp из секунд в дату', () => {
    const expiresAt = Math.floor(Date.UTC(2027, 0, 1) / 1000);

    expect(parseTokenExpiry(jwtWith({ exp: expiresAt }))).toEqual(new Date(expiresAt * 1000));
  });

  it('возвращает null, если частей не три', () => {
    expect(parseTokenExpiry('не.токен')).toBeNull();
    expect(parseTokenExpiry('')).toBeNull();
  });

  it('возвращает null на непригодной полезной нагрузке', () => {
    expect(parseTokenExpiry('a.не-base64-json.c')).toBeNull();
    expect(parseTokenExpiry(jwtWith(['exp']))).toBeNull();
  });

  it('возвращает null, если exp не конечное число', () => {
    expect(parseTokenExpiry(jwtWith({ exp: '1800000000' }))).toBeNull();
    expect(parseTokenExpiry(jwtWith({}))).toBeNull();
  });
});

describe('разбор списка', () => {
  it('считает непригодные элементы отдельно', () => {
    const result = parseList([RAW_FIRM, { id: 'нет' }, RAW_FIRM], parseFirm);

    expect(result).toMatchObject({ malformed: 1 });
    expect(result?.items).toHaveLength(2);
  });

  it('возвращает null, если пришел не массив', () => {
    expect(parseList({ items: [] }, parseFirm)).toBeNull();
  });

  it('пустой массив не считается ошибкой', () => {
    expect(parseList([], parseFirm)).toEqual({ items: [], malformed: 0 });
  });
});
