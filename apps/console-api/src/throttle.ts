import type { ThrottlerOptions } from '@nestjs/throttler';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * Общий предел обращений с одного адреса.
 *
 * Рассчитан на работу человека в консоли: открытие страницы обходится в
 * несколько запросов, а опрос состояния синхронизации добавляет по одному
 * в несколько секунд.
 */
export const DEFAULT_THROTTLE: ThrottlerOptions = { ttl: MINUTE_MS, limit: 100 };

/**
 * Вход в консоль: подбор пароля требует несопоставимо больше попыток.
 *
 * Запас оставлен намеренно - человек, ошибившийся раскладкой, не должен
 * упереться в отказ.
 */
export const SIGN_IN_THROTTLE: ThrottlerOptions = { ttl: MINUTE_MS, limit: 10 };

/** Регистрация выполняется однократно, поэтому окно взято длиннее. */
export const SIGN_UP_THROTTLE: ThrottlerOptions = { ttl: HOUR_MS, limit: 5 };

/**
 * Привязка аккаунта агрегатора.
 *
 * Каждая попытка уходит в MyReviews с чужими учетными данными и расходует
 * лимит запросов там, поэтому предел строже общего.
 */
export const CONNECT_THROTTLE: ThrottlerOptions = { ttl: MINUTE_MS, limit: 5 };
