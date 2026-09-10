import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { User, Workspace } from '@reviews/database';
import { PasswordService } from './password.service';
import type { AuthenticatedUser } from './auth.types';
import type { AuthResponseDto, CurrentUserResponseDto } from './dto/auth-response.dto';
import type { SignInDto } from './dto/sign-in.dto';
import type { SignUpDto } from './dto/sign-up.dto';

/** Ключ виджета публичен по своей природе, домен ограничивает его использование. */
const API_KEY_BYTES = 24;

const generateApiKey = (): string => randomBytes(API_KEY_BYTES).toString('base64url');

const isDuplicateKeyError = (error: unknown): boolean => {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
};

/** Полезная нагрузка токена консоли: идентификатор пользователя. */
interface TokenPayload {
  sub: string;
}

const isTokenPayload = (value: unknown): value is TokenPayload => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'sub' in value &&
    typeof value.sub === 'string' &&
    Types.ObjectId.isValid(value.sub)
  );
};

/** Регистрация, вход в консоль и опознание пользователя по токену. */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Workspace.name) private readonly workspaceModel: Model<Workspace>,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
  ) {}

  /** Регистрация создает пользователя вместе с его рабочим кабинетом. */
  async signUp(dto: SignUpDto): Promise<AuthResponseDto> {
    const email = dto.email.toLowerCase().trim();
    const name = dto.name.trim();

    if ((await this.userModel.exists({ email })) !== null) {
      throw new ConflictException('Этот адрес уже зарегистрирован');
    }

    const workspace = await this.workspaceModel.create({
      name: dto.workspaceName?.trim() ?? name,
      apiKey: generateApiKey(),
      allowedDomains: [],
    });

    try {
      const user = await this.userModel.create({
        workspaceId: workspace._id,
        email,
        passwordHash: await this.passwordService.hash(dto.password),
        name,
      });

      return await this.buildResponse(user._id, email, name, workspace._id);
    } catch (error) {
      // Транзакций нет (одиночный mongod), поэтому кабинет без пользователя
      // удаляется вручную, иначе он остается в базе.
      await this.removeWorkspace(workspace._id);

      if (isDuplicateKeyError(error)) {
        throw new ConflictException('Этот адрес уже зарегистрирован');
      }

      throw error;
    }
  }

  /** Проверяет учетные данные и выдает токен консоли. */
  async signIn(dto: SignInDto): Promise<AuthResponseDto> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.userModel.findOne({ email, isActive: true });

    // Сообщение одинаковое в обоих случаях, чтобы не подсказывать,
    // зарегистрирован ли такой адрес.
    if (user === null) {
      throw new UnauthorizedException('Неверный адрес или пароль');
    }

    if (!(await this.passwordService.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Неверный адрес или пароль');
    }

    await this.userModel.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

    return this.buildResponse(user._id, user.email, user.name, user.workspaceId);
  }

  /** Сведения о текущем пользователе консоли. */
  async getCurrentUser(user: AuthenticatedUser): Promise<CurrentUserResponseDto> {
    const workspace = await this.workspaceModel.findById(user.workspaceId);

    if (workspace === null) {
      throw new NotFoundException('Кабинет не найден');
    }

    return {
      id: user.id.toString(),
      email: user.email,
      name: user.name,
      workspaceId: user.workspaceId.toString(),
      workspaceName: workspace.name,
    };
  }

  /** Опознает пользователя консоли по значению заголовка Authorization. */
  async authenticateUser(header: string | undefined): Promise<AuthenticatedUser> {
    if (header === undefined || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Отсутствует токен доступа');
    }

    // verifyAsync ограничивает параметр типом object, поэтому форма полезной
    // нагрузки проверяется отдельно.
    let payload: object;

    try {
      payload = await this.jwtService.verifyAsync<object>(header.slice('Bearer '.length));
    } catch {
      throw new UnauthorizedException('Токен недействителен или истек');
    }

    if (!isTokenPayload(payload)) {
      throw new UnauthorizedException('Недопустимое содержимое токена');
    }

    // Пользователь перечитывается из базы: иначе отключенная учетная запись
    // сохраняет доступ до истечения токена.
    const user = await this.userModel.findOne({
      _id: new Types.ObjectId(payload.sub),
      isActive: true,
    });

    if (user === null) {
      throw new UnauthorizedException('Учетная запись отключена');
    }

    return {
      id: user._id,
      workspaceId: user.workspaceId,
      email: user.email,
      name: user.name,
    };
  }

  /** Собирает ответ входа и регистрации, подписывая токен консоли. */
  private async buildResponse(
    userId: Types.ObjectId,
    email: string,
    name: string,
    workspaceId: Types.ObjectId,
  ): Promise<AuthResponseDto> {
    const token = await this.jwtService.signAsync({ sub: userId.toString() });

    return {
      token,
      user: { id: userId.toString(), email, name },
      workspaceId: workspaceId.toString(),
    };
  }

  /**
   * Удаляет кабинет, созданный при неудавшейся регистрации.
   *
   * Отказ самого удаления наружу не выпускается: он подменил бы причину
   * отказа регистрации, и вместо занятого адреса пользователь получил бы
   * невнятную ошибку.
   */
  private async removeWorkspace(workspaceId: Types.ObjectId): Promise<void> {
    try {
      await this.workspaceModel.deleteOne({ _id: workspaceId });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';

      this.logger.error(`Не удалось удалить кабинет ${workspaceId.toString()}: ${reason}`);
    }
  }
}
