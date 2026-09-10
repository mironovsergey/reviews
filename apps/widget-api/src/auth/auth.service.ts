import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Workspace } from '@reviews/database';
import { Model } from 'mongoose';
import type { RequestWorkspace } from './auth.types';

/** Имя узла из значения заголовка Origin. */
const originHostname = (origin: string | undefined): string | null => {
  if (origin === undefined) {
    return null;
  }

  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
};

/** Опознание кабинета по публичному ключу виджета. */
@Injectable()
export class AuthService {
  constructor(@InjectModel(Workspace.name) private readonly workspaceModel: Model<Workspace>) {}

  /**
   * Возвращает кабинет, которому принадлежит ключ.
   *
   * Ключ доступен в исходном коде страницы размещения, поэтому единственной
   * его защитой служит совпадение источника запроса с доменом кабинета.
   *
   * Вместе с идентификатором возвращаются условия вывода отзывов: запись
   * кабинета уже прочитана, и отдельного обращения к базе они не стоят.
   * Записи, созданные до появления условий, поля не содержат, но Mongoose
   * подставляет значение по умолчанию при чтении - проверено.
   */
  async authenticateWidget(
    apiKey: string | undefined,
    origin: string | undefined,
  ): Promise<RequestWorkspace> {
    if (apiKey === undefined || apiKey.length === 0) {
      throw new UnauthorizedException('Отсутствует ключ доступа');
    }

    const workspace = await this.workspaceModel.findOne({ apiKey, isActive: true });

    if (workspace === null) {
      throw new UnauthorizedException('Неизвестный ключ доступа');
    }

    const hostname = originHostname(origin);

    if (hostname === null || !workspace.allowedDomains.includes(hostname)) {
      throw new ForbiddenException('Домен не разрешен для этого кабинета');
    }

    return { id: workspace._id, reviewFilter: workspace.reviewFilter };
  }
}
