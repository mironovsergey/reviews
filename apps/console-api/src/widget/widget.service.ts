import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import type { ConsoleApiEnv } from '../env';
import type { WidgetResponseDto } from './dto/widget-response.dto';
import { Workspace } from '@reviews/database';

const HOSTNAME_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/u;

/** Принимается и «example.com», и «https://example.com/path»: извлекается хост. */
const toHostname = (raw: string): string | null => {
  const trimmed = raw.trim().toLowerCase();

  if (trimmed.length === 0) {
    return null;
  }

  if (!trimmed.includes('://')) {
    return trimmed;
  }

  try {
    return new URL(trimmed).hostname;
  } catch {
    return trimmed;
  }
};

/** Настройки кабинета: ключ виджета и разрешенные домены. */
@Injectable()
export class WidgetService {
  constructor(
    @InjectModel(Workspace.name) private readonly workspaceModel: Model<Workspace>,
    private readonly config: ConfigService<ConsoleApiEnv, true>,
  ) {}

  /** Возвращает ключ кабинета, разрешенные домены и код вставки. */
  async getSettings(workspaceId: Types.ObjectId): Promise<WidgetResponseDto> {
    const workspace = await this.workspaceModel.findById(workspaceId);

    if (workspace === null) {
      throw new NotFoundException('Кабинет не найден');
    }

    return this.toResponse(workspace.apiKey, workspace.allowedDomains);
  }

  /**
   * При пустом списке доменов виджет получает 403 на сайте размещения:
   * проверка Origin служит единственной защитой публичного ключа.
   */
  async updateDomains(workspaceId: Types.ObjectId, domains: string[]): Promise<WidgetResponseDto> {
    const normalized = this.normalizeDomains(domains);

    const workspace = await this.workspaceModel.findOneAndUpdate(
      { _id: workspaceId },
      { $set: { allowedDomains: normalized } },
      { returnDocument: 'after' },
    );

    if (workspace === null) {
      throw new NotFoundException('Кабинет не найден');
    }

    return this.toResponse(workspace.apiKey, workspace.allowedDomains);
  }

  /**
   * Приводит список к именам узлов и отбрасывает повторы.
   *
   * Значение, не являющееся именем узла, отвергается целиком: молчаливый
   * пропуск оставил бы клиента с настройкой, которой он не задавал.
   */
  private normalizeDomains(input: string[]): string[] {
    const domains = new Set<string>();

    for (const raw of input) {
      const hostname = toHostname(raw);

      if (hostname === null) {
        continue;
      }

      if (!HOSTNAME_PATTERN.test(hostname)) {
        throw new BadRequestException(`Недопустимое имя домена: ${raw}`);
      }

      domains.add(hostname);
    }

    return [...domains];
  }

  /** Код вставки: элемент виджета и регистрирующий его модуль. */
  private toResponse(apiKey: string, allowedDomains: string[]): WidgetResponseDto {
    // Адрес API в коде вставки не требуется: он подставлен в скрипт при сборке.
    const snippet = [
      `<reviews-widget api-key="${apiKey}"></reviews-widget>`,
      `<script type="module" src="${this.config.get('WIDGET_SCRIPT_URL', { infer: true })}"></script>`,
    ].join('\n');

    return { apiKey, allowedDomains, snippet };
  }
}
