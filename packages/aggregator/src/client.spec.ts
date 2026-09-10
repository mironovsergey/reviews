import { afterEach, describe, expect, it, vi } from 'vitest';
import { AggregatorClient } from './client';
import {
  AggregatorAuthError,
  AggregatorError,
  AggregatorRateLimitError,
  AggregatorResponseError,
} from './errors';

const BASE_URL = 'https://myreviews.test';
const TOKEN = 'jwt-token';

/** Максимальное число повторов при 429 и основание задержки; см. client.ts. */
const MAX_RATE_LIMIT_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1_000;

/** Предохранитель от бесконечного обхода; см. client.ts. */
const MAX_PAGES = 1_000;

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

const jsonResponse = (
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response =>
  new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });

/** Подставляет fetch и возвращает клиент вместе с подставным вызовом. */
const build = (...responses: (Response | Error)[]) => {
  const fetchMock = vi.fn();

  for (const response of responses) {
    if (response instanceof Error) {
      fetchMock.mockRejectedValueOnce(response);
    } else {
      fetchMock.mockResolvedValueOnce(response);
    }
  }

  vi.stubGlobal('fetch', fetchMock);

  return { client: new AggregatorClient(BASE_URL), fetchMock };
};

/** Первый аргумент вызова fetch: полный адрес запроса. */
const requestedUrl = (fetchMock: ReturnType<typeof vi.fn>, call = 0): string => {
  const [url] = fetchMock.mock.calls[call] as [string];

  return url;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('вход', () => {
  it('отправляет учетные данные и возвращает токен', async () => {
    const { client, fetchMock } = build(jsonResponse({ data: { jwt: TOKEN } }));

    await expect(client.login('clinic@example.com', 'secret')).resolves.toBe(TOKEN);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe(`${BASE_URL}/v1/user/login`);
    expect(init.method).toBe('POST');
    expect(init.body).toBe(
      JSON.stringify({ LoginForm: { email: 'clinic@example.com', password: 'secret' } }),
    );
  });

  it('переводит отказ 400 в ошибку учетных данных', async () => {
    // На неверный пароль агрегатор отвечает кодом 400, а не 401.
    const { client } = build(jsonResponse({ message: 'bad' }, { status: 400 }));

    await expect(client.login('clinic@example.com', 'bad')).rejects.toBeInstanceOf(
      AggregatorAuthError,
    );
  });

  it('отвергает ответ без токена', async () => {
    const { client } = build(jsonResponse({ data: {} }));

    await expect(client.login('clinic@example.com', 'secret')).rejects.toBeInstanceOf(
      AggregatorResponseError,
    );
  });
});

describe('коды состояния', () => {
  it('переводит 401 в ошибку токена', async () => {
    const { client } = build(jsonResponse({}, { status: 401 }));

    await expect(client.fetchProfile(TOKEN)).rejects.toBeInstanceOf(AggregatorAuthError);
  });

  it('сохраняет код состояния в прочих ошибках', async () => {
    const { client } = build(jsonResponse({}, { status: 503 }));

    await expect(client.fetchProfile(TOKEN)).rejects.toMatchObject({
      name: 'AggregatorError',
      status: 503,
    });
  });

  it('переводит непригодный JSON в ошибку ответа', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>', { status: 200 })));

    await expect(new AggregatorClient(BASE_URL).fetchProfile(TOKEN)).rejects.toBeInstanceOf(
      AggregatorResponseError,
    );
  });

  it('переводит отказ сети в ошибку клиента', async () => {
    const { client } = build(new TypeError('fetch failed'));

    await expect(client.fetchProfile(TOKEN)).rejects.toBeInstanceOf(AggregatorError);
  });
});

describe('ограничение частоты запросов', () => {
  it('повторяет запрос с удвоением паузы и возвращает ответ', async () => {
    vi.useFakeTimers();

    const { client, fetchMock } = build(
      jsonResponse({}, { status: 429 }),
      jsonResponse({}, { status: 429 }),
      jsonResponse({ data: { id: 7, email: 'clinic@example.com' } }),
    );

    const pending = client.fetchProfile(TOKEN);

    await vi.advanceTimersByTimeAsync(RETRY_BASE_DELAY_MS);
    await vi.advanceTimersByTimeAsync(RETRY_BASE_DELAY_MS * 2);

    await expect(pending).resolves.toMatchObject({ id: 7 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('прекращает повторы и сообщает об исчерпании лимита', async () => {
    vi.useFakeTimers();

    const { client, fetchMock } = build(
      ...Array.from({ length: MAX_RATE_LIMIT_RETRIES + 1 }, () =>
        jsonResponse({}, { status: 429 }),
      ),
    );

    const pending = client.fetchProfile(TOKEN);
    const expectation = expect(pending).rejects.toBeInstanceOf(AggregatorRateLimitError);

    for (let attempt = 0; attempt < MAX_RATE_LIMIT_RETRIES; attempt += 1) {
      await vi.advanceTimersByTimeAsync(RETRY_BASE_DELAY_MS * 2 ** attempt);
    }

    await expectation;
    expect(fetchMock).toHaveBeenCalledTimes(MAX_RATE_LIMIT_RETRIES + 1);
  });
});

describe('список организаций', () => {
  it('передает токен и запрашивает страницу предельного размера', async () => {
    const { client, fetchMock } = build(jsonResponse({ data: [RAW_FIRM] }));

    await client.fetchFirms(TOKEN);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;

    expect(url).toBe(`${BASE_URL}/v1/firm/list?per-page=250`);
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('пропускает непригодные записи, сохраняя остальные', async () => {
    const { client } = build(jsonResponse({ data: [RAW_FIRM, { id: 'нет' }] }));

    await expect(client.fetchFirms(TOKEN)).resolves.toHaveLength(1);
  });

  it('отвергает ответ, не содержащий списка', async () => {
    const { client } = build(jsonResponse({ data: { id: 10 } }));

    await expect(client.fetchFirms(TOKEN)).rejects.toBeInstanceOf(AggregatorResponseError);
  });
});

describe('страница отзывов', () => {
  it('запрашивает сортировку по убыванию идентификатора', async () => {
    const { client, fetchMock } = build(jsonResponse([RAW_REVIEW]));

    await client.fetchReviewPage(TOKEN, 2);

    expect(requestedUrl(fetchMock)).toBe(
      `${BASE_URL}/v1/review/index?per-page=250&page=2&sort=-id`,
    );
  });

  it('читает сведения о пагинации из заголовков', async () => {
    const { client } = build(
      jsonResponse([RAW_REVIEW], {
        headers: { 'x-pagination-page-count': '4', 'x-pagination-total-count': '900' },
      }),
    );

    await expect(client.fetchReviewPage(TOKEN, 1)).resolves.toMatchObject({
      pageCount: 4,
      totalCount: 900,
    });
  });

  it('сводит отсутствующие и непригодные заголовки к null', async () => {
    // Значение заголовка ограничено ByteString, поэтому непригодное значение
    // взято латиницей.
    const { client } = build(
      jsonResponse([RAW_REVIEW], { headers: { 'x-pagination-page-count': 'unknown' } }),
    );

    await expect(client.fetchReviewPage(TOKEN, 1)).resolves.toMatchObject({
      pageCount: null,
      totalCount: null,
    });
  });
});

describe('обход отзывов', () => {
  const collect = async (client: AggregatorClient): Promise<number> => {
    let total = 0;

    for await (const batch of client.iterateReviews(TOKEN)) {
      total += batch.length;
    }

    return total;
  };

  it('проходит столько страниц, сколько указано в заголовке', async () => {
    const page = (): Response =>
      jsonResponse([RAW_REVIEW], { headers: { 'x-pagination-page-count': '3' } });
    const { client, fetchMock } = build(page(), page(), page());

    await expect(collect(client)).resolves.toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('останавливается на пустой странице, не доверяя счетчику', async () => {
    const { client, fetchMock } = build(
      jsonResponse([RAW_REVIEW], { headers: { 'x-pagination-page-count': '9' } }),
      jsonResponse([], { headers: { 'x-pagination-page-count': '9' } }),
    );

    await expect(collect(client)).resolves.toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('прекращает обход на предельной странице без заголовков пагинации', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(jsonResponse([RAW_REVIEW]))),
    );

    const client = new AggregatorClient(BASE_URL);

    await expect(collect(client)).resolves.toBe(MAX_PAGES);
  });
});
