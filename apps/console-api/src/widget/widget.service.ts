import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import type { ConsoleApiEnv } from '../env';
import type { TargetSnippetResponseDto } from './dto/target-snippet-response.dto';
import type { WidgetResponseDto } from './dto/widget-response.dto';
import { ReviewTarget, Workspace } from '@reviews/database';

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

/** Настройки кабинета: ключ виджета, разрешенные домены и код вставки. */
@Injectable()
export class WidgetService {
  constructor(
    @InjectModel(Workspace.name) private readonly workspaceModel: Model<Workspace>,
    @InjectModel(ReviewTarget.name) private readonly targetModel: Model<ReviewTarget>,
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
   * Код вставки для страницы одной клиники или одного врача.
   *
   * Цель отбирается вместе с кабинетом. Код с идентификатором чужой цели
   * вывел бы на сайте пустую ленту, поэтому такой запрос отклоняется так же,
   * как запрос несуществующей цели.
   */
  async getTargetSnippet(
    workspaceId: Types.ObjectId,
    targetId: string,
  ): Promise<TargetSnippetResponseDto> {
    const [workspace, target] = await Promise.all([
      this.workspaceModel.findById(workspaceId),
      this.targetModel.exists({ _id: new Types.ObjectId(targetId), workspaceId }),
    ]);

    if (workspace === null) {
      throw new NotFoundException('Кабинет не найден');
    }

    if (target === null) {
      throw new NotFoundException('Клиника или врач не найдены');
    }

    return { targetId, snippet: this.buildSnippet(workspace.apiKey, targetId) };
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

  private toResponse(apiKey: string, allowedDomains: string[]): WidgetResponseDto {
    return { apiKey, allowedDomains, snippet: this.buildSnippet(apiKey) };
  }

  /**
   * Код вставки: элемент виджета и регистрирующий его модуль.
   *
   * Без цели виджет выводит все отзывы кабинета с фильтром, с целью только
   * ее отзывы и без фильтра. Адрес API в коде не требуется: он подставлен в
   * скрипт при сборке. Значения атрибутов экранирования не требуют: ключ
   * состоит из символов base64url, идентификатор цели из шестнадцатеричных
   * цифр.
   */
  private buildSnippet(apiKey: string, targetId?: string): string {
    const targetAttribute = targetId === undefined ? '' : ` target-id="${targetId}"`;

    return [
      `<reviews-widget api-key="${apiKey}"${targetAttribute}></reviews-widget>`,
      `<script type="module" src="${this.config.get('WIDGET_SCRIPT_URL', { infer: true })}"></script>`,
    ].join('\n');
  }
}
