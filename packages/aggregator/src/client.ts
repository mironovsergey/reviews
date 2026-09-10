import { Logger } from '@nestjs/common';
import {
  AggregatorAuthError,
  AggregatorError,
  AggregatorRateLimitError,
  AggregatorResponseError,
} from './errors';
import {
  parseFirm,
  parseList,
  parseLoginToken,
  parseProfile,
  parseReview,
  unwrapPayload,
} from './parser';
import type {
  AggregatorRawFirm,
  AggregatorRawProfile,
  AggregatorRawReview,
  AggregatorReviewPage,
} from './types';

const REQUEST_TIMEOUT_MS = 30_000;

/** Максимальный размер страницы, который принимает агрегатор. */
const PAGE_SIZE = 250;

/**
 * Предохранитель от бесконечного обхода, если сервер перестанет отдавать
 * заголовки пагинации. При размере страницы 250 это 250 000 отзывов.
 */
const MAX_PAGES = 1_000;

const MAX_RATE_LIMIT_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1_000;

const sleep = (ms: number): Promise<void> => {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
};

const readIntHeader = (headers: Headers, name: string): number | null => {
  const raw = headers.get(name);

  if (raw === null) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);

  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};

interface AggregatorResponse {
  payload: unknown;
  headers: Headers;
}

/**
 * Клиент личного кабинета агрегатора.
 *
 * Адрес службы передается при создании: пакет не зависит от того, как
 * приложение хранит настройки.
 */
export class AggregatorClient {
  private readonly logger = new Logger(AggregatorClient.name);

  constructor(private readonly baseUrl: string) {}

  /**
   * Обменивает логин и пароль на JWT. Пароль не сохраняется и содержится
   * только в теле этого запроса.
   */
  async login(email: string, password: string): Promise<string> {
    let response: AggregatorResponse;

    try {
      response = await this.request('/v1/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ LoginForm: { email, password } }),
      });
    } catch (error) {
      // На неверные учетные данные агрегатор отвечает кодом 400, а не 401.
      if (error instanceof AggregatorError && error.status === 400) {
        throw new AggregatorAuthError('MyReviews отклонил учетные данные');
      }

      throw error;
    }

    const token = parseLoginToken(unwrapPayload(response.payload));

    if (token === null) {
      throw new AggregatorResponseError('Ответ MyReviews на вход не содержит токена');
    }

    return token;
  }

  /** Возвращает сведения о владельце аккаунта. */
  async fetchProfile(token: string): Promise<AggregatorRawProfile> {
    const { payload } = await this.request('/v1/user/profile', {
      headers: this.authHeaders(token),
    });

    const profile = parseProfile(unwrapPayload(payload));

    if (profile === null) {
      throw new AggregatorResponseError('Неожиданный вид ответа MyReviews с профилем');
    }

    return profile;
  }

  /** Клиники и врачи приходят одним списком, различаясь полем `type`. */
  async fetchFirms(token: string): Promise<AggregatorRawFirm[]> {
    const { payload } = await this.request(`/v1/firm/list?per-page=${PAGE_SIZE}`, {
      headers: this.authHeaders(token),
    });

    const list = parseList(unwrapPayload(payload), parseFirm);

    if (list === null) {
      throw new AggregatorResponseError('Неожиданный вид ответа MyReviews со списком организаций');
    }

    if (list.malformed > 0) {
      this.logger.warn(`Пропущено организаций с непригодными данными: ${list.malformed}`);
    }

    return list.items;
  }

  /**
   * Возвращает страницу отзывов вместе со сведениями о пагинации.
   *
   * Сортировка по убыванию идентификатора: новые отзывы появляются в начале
   * выдачи и не смещают уже пройденные страницы.
   */
  async fetchReviewPage(token: string, page: number): Promise<AggregatorReviewPage> {
    const query = `per-page=${PAGE_SIZE}&page=${page}&sort=-id`;

    const { payload, headers } = await this.request(`/v1/review/index?${query}`, {
      headers: this.authHeaders(token),
    });

    const list = parseList(unwrapPayload(payload), parseReview);

    if (list === null) {
      throw new AggregatorResponseError('Неожиданный вид ответа MyReviews со списком отзывов');
    }

    if (list.malformed > 0) {
      this.logger.warn(
        `Пропущено отзывов с непригодными данными на странице ${page}: ${list.malformed}`,
      );
    }

    return {
      items: list.items,
      pageCount: readIntHeader(headers, 'x-pagination-page-count'),
      totalCount: readIntHeader(headers, 'x-pagination-total-count'),
    };
  }

  /**
   * Обходит все отзывы аккаунта постранично.
   *
   * Обход выполняется без фильтра по организации: суммарное число отзывов
   * по всем организациям совпадает с общим, поэтому один проход охватывает
   * и клиники, и врачей.
   */
  async *iterateReviews(token: string): AsyncGenerator<AggregatorRawReview[]> {
    const firstPage = await this.fetchReviewPage(token, 1);

    yield firstPage.items;

    const lastPage =
      firstPage.pageCount === null ? MAX_PAGES : Math.min(firstPage.pageCount, MAX_PAGES);

    for (let page = 2; page <= lastPage; page += 1) {
      const nextPage = await this.fetchReviewPage(token, page);

      // Пустая страница означает конец выдачи независимо от счетчика.
      if (nextPage.items.length === 0) {
        return;
      }

      yield nextPage.items;
    }
  }

  /** Заголовки запроса от имени владельца аккаунта. */
  private authHeaders(token: string): Record<string, string> {
    return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  }

  /** Выполняет запрос, повторяя его при 429 с экспоненциальной паузой. */
  private async request(path: string, init: RequestInit): Promise<AggregatorResponse> {
    for (let attempt = 0; ; attempt += 1) {
      const response = await this.send(path, init);

      if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * 2 ** attempt;

        this.logger.warn(
          `MyReviews ограничил частоту запросов на ${path}, повтор через ${delay} мс`,
        );
        await sleep(delay);
        continue;
      }

      return { payload: await this.readBody(response, path), headers: response.headers };
    }
  }

  /** Выполняет обращение к агрегатору, приводя отказ сети к ошибке клиента. */
  private async send(path: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';

      throw new AggregatorError(`Запрос к ${path} не выполнен: ${reason}`);
    }
  }

  /**
   * Разбирает тело ответа, переводя коды состояния в ошибки клиента.
   *
   * Отказ токена и исчерпание лимита выделены в отдельные виды: первый
   * требует переподключения аккаунта, второй допускает повтор.
   */
  private async readBody(response: Response, path: string): Promise<unknown> {
    if (response.status === 401) {
      throw new AggregatorAuthError(`MyReviews отклонил токен на ${path}`);
    }

    if (response.status === 429) {
      throw new AggregatorRateLimitError(
        `Исчерпаны повторы при ограничении частоты запросов на ${path}`,
      );
    }

    if (!response.ok) {
      throw new AggregatorError(
        `MyReviews ответил кодом ${response.status} на ${path}`,
        response.status,
      );
    }

    try {
      const body: unknown = await response.json();

      return body;
    } catch {
      throw new AggregatorResponseError(`MyReviews вернул недопустимый JSON на ${path}`);
    }
  }
}
