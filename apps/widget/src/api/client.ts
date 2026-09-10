import { ApiError } from './error';
import { parseList, parseReviewsPage, parseTarget } from './parsers';
import type { ListReviewsParams, ReviewsPage, Target } from './types';

const DOCTOR_SUGGESTIONS_LIMIT = 8;
const CLINICS_LIMIT = 100;

/**
 * Клиент API виджета.
 *
 * Каждый метод принимает `AbortSignal`: без него задача не отменяет
 * устаревший запуск, и ответ на прежний запрос перезаписывает актуальный.
 */
export class ApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    // Завершающий слэш иначе образует двойной разделитель в пути.
    this.baseUrl = baseUrl.replace(/\/+$/u, '');
    this.apiKey = apiKey;
  }

  async listClinics(signal?: AbortSignal): Promise<Target[]> {
    const payload = await this.request(`/targets?kind=clinic&limit=${CLINICS_LIMIT}`, signal);

    return parseList(payload, parseTarget);
  }

  async searchDoctors(query: string, signal?: AbortSignal): Promise<Target[]> {
    const params = new URLSearchParams({
      kind: 'doctor',
      search: query,
      limit: String(DOCTOR_SUGGESTIONS_LIMIT),
    });

    return parseList(await this.request(`/targets?${params.toString()}`, signal), parseTarget);
  }

  async listReviews(params: ListReviewsParams, signal?: AbortSignal): Promise<ReviewsPage> {
    const search = new URLSearchParams();

    if (params.targetId !== undefined && params.targetId !== null) {
      search.set('targetId', params.targetId);
    }

    if (params.cursor !== undefined && params.cursor !== null) {
      search.set('cursor', params.cursor);
    }

    if (params.limit !== undefined) {
      search.set('limit', String(params.limit));
    }

    const query = search.toString();

    return parseReviewsPage(
      await this.request(`/reviews${query.length > 0 ? `?${query}` : ''}`, signal),
    );
  }

  private async request(path: string, signal?: AbortSignal): Promise<unknown> {
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        headers: { 'X-API-Key': this.apiKey },
        signal,
      });
    } catch (exception: unknown) {
      // Отмена пробрасывается без изменений: для задачи это штатное завершение.
      if (exception instanceof DOMException && exception.name === 'AbortError') {
        throw exception;
      }

      throw new ApiError('Не удалось связаться с сервером отзывов', { cause: exception });
    }

    if (!response.ok) {
      throw new ApiError('Не удалось загрузить отзывы', { status: response.status });
    }

    try {
      const body: unknown = await response.json();

      return body;
    } catch {
      throw new ApiError('Сервер отзывов вернул некорректный ответ');
    }
  }
}
