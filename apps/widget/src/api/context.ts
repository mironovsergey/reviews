import { createContext } from '@lit/context';
import type { ApiClient } from './client';

/**
 * Контекст клиента API.
 *
 * Клиент создает корневой компонент, владеющий адресом и ключом, и передает
 * его вложенным. Контекст размещен рядом с клиентом как часть его контракта.
 *
 * Потребитель получает `ApiClient | undefined`: до подключения к поставщику
 * значение отсутствует. Иных причин допускать `undefined` нет.
 */
export const apiClientContext = createContext<ApiClient | undefined>(Symbol('reviews-api-client'));
