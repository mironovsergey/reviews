import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { Model, Types } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import type { User, UserDocument, Workspace, WorkspaceDocument } from '@reviews/database';
import { AuthService } from './auth.service';
import type { PasswordService } from './password.service';

const WORKSPACE_ID = new Types.ObjectId();
const USER_ID = new Types.ObjectId();

const workspace = (overrides: Partial<Workspace> = {}): WorkspaceDocument =>
  ({
    _id: WORKSPACE_ID,
    name: 'Клиника',
    apiKey: 'public-key',
    allowedDomains: ['clinic.example.ru'],
    isActive: true,
    ...overrides,
  }) as WorkspaceDocument;

const user = (overrides: Partial<User> = {}): UserDocument =>
  ({
    _id: USER_ID,
    workspaceId: WORKSPACE_ID,
    email: 'doc@example.com',
    passwordHash: 'hash',
    name: 'Иван',
    isActive: true,
    ...overrides,
  }) as UserDocument;

interface Options {
  existingUser?: boolean;
  foundUser?: UserDocument | null;
  foundWorkspace?: WorkspaceDocument | null;
  verify?: boolean;
}

const build = (options: Options = {}) => {
  const userModel = {
    exists: vi.fn().mockResolvedValue(options.existingUser === true ? { _id: USER_ID } : null),
    create: vi.fn().mockResolvedValue(user()),
    findOne: vi.fn().mockResolvedValue(options.foundUser ?? null),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
  };
  const workspaceModel = {
    create: vi.fn().mockResolvedValue(workspace()),
    findById: vi
      .fn()
      .mockResolvedValue(
        options.foundWorkspace === undefined ? workspace() : options.foundWorkspace,
      ),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
  };
  const passwordService: PasswordService = {
    hash: vi.fn((): Promise<string> => Promise.resolve('hash')),
    verify: vi.fn((): Promise<boolean> => Promise.resolve(options.verify ?? true)),
  };
  const jwtService = {
    signAsync: vi.fn((): Promise<string> => Promise.resolve('token')),
    verifyAsync: vi.fn((): Promise<object> => Promise.resolve({ sub: USER_ID.toString() })),
  };

  return {
    service: new AuthService(
      userModel as unknown as Model<User>,
      workspaceModel as unknown as Model<Workspace>,
      passwordService,
      jwtService as unknown as JwtService,
    ),
    userModel,
    workspaceModel,
    passwordService,
    jwtService,
  };
};

const signUpDto = { name: 'Иван', email: 'doc@example.com', password: 'password' };

/** Матчер Vitest объявлен как any и сохраняется отдельным значением. */
const anyDate: unknown = expect.any(Date);

describe('регистрация', () => {
  it('создает кабинет и пользователя, возвращая токен', async () => {
    const { service, workspaceModel, userModel } = build();

    const result = await service.signUp(signUpDto);

    expect(result.token).toBe('token');
    expect(result.workspaceId).toBe(WORKSPACE_ID.toString());
    expect(workspaceModel.create).toHaveBeenCalledTimes(1);
    expect(userModel.create).toHaveBeenCalledTimes(1);
  });

  it('приводит адрес к нижнему регистру и отсекает пробелы', async () => {
    const { service, userModel } = build();

    await service.signUp({ ...signUpDto, email: '  DOC@Example.COM  ' });

    expect(userModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'doc@example.com' }),
    );
  });

  it('называет кабинет именем пользователя, если название не задано', async () => {
    const { service, workspaceModel } = build();

    await service.signUp(signUpDto);

    expect(workspaceModel.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Иван' }));
  });

  it('отвергает повторную регистрацию адреса', async () => {
    const { service, workspaceModel } = build({ existingUser: true });

    await expect(service.signUp(signUpDto)).rejects.toBeInstanceOf(ConflictException);
    expect(workspaceModel.create).not.toHaveBeenCalled();
  });

  it('удаляет кабинет, если создать пользователя не удалось', async () => {
    const { service, userModel, workspaceModel } = build();
    userModel.create.mockRejectedValue(new Error('запись не удалась'));

    await expect(service.signUp(signUpDto)).rejects.toThrow('запись не удалась');
    expect(workspaceModel.deleteOne).toHaveBeenCalledWith({ _id: WORKSPACE_ID });
  });

  it('распознает гонку по уникальному индексу как повтор адреса', async () => {
    const { service, userModel, workspaceModel } = build();
    userModel.create.mockRejectedValue({ code: 11000 });

    await expect(service.signUp(signUpDto)).rejects.toBeInstanceOf(ConflictException);
    expect(workspaceModel.deleteOne).toHaveBeenCalledWith({ _id: WORKSPACE_ID });
  });

  it('сохраняет причину отказа, когда удалить кабинет не удалось', async () => {
    const { service, userModel, workspaceModel } = build();
    userModel.create.mockRejectedValue({ code: 11000 });
    workspaceModel.deleteOne.mockRejectedValue(new Error('соединение потеряно'));

    await expect(service.signUp(signUpDto)).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('вход', () => {
  it('выдает токен по верным данным и отмечает вход', async () => {
    const { service, userModel } = build({ foundUser: user() });

    const result = await service.signIn({ email: 'doc@example.com', password: 'password' });

    expect(result.token).toBe('token');
    expect(userModel.updateOne).toHaveBeenCalledWith(
      { _id: USER_ID },
      { $set: { lastLoginAt: anyDate } },
    );
  });

  it.each([
    ['неизвестном адресе', { foundUser: null }],
    ['неверном пароле', { foundUser: user(), verify: false }],
  ])('сообщает одно и то же при %s', async (_name, options: Options) => {
    const { service } = build(options);

    await expect(
      service.signIn({ email: 'doc@example.com', password: 'password' }),
    ).rejects.toThrow('Неверный адрес или пароль');
  });

  it('не отмечает вход при неверном пароле', async () => {
    const { service, userModel } = build({ foundUser: user(), verify: false });

    await expect(
      service.signIn({ email: 'doc@example.com', password: 'password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(userModel.updateOne).not.toHaveBeenCalled();
  });
});

describe('опознание пользователя консоли', () => {
  it('возвращает пользователя по действующему токену', async () => {
    const { service } = build({ foundUser: user() });

    await expect(service.authenticateUser('Bearer token')).resolves.toMatchObject({
      id: USER_ID,
      workspaceId: WORKSPACE_ID,
    });
  });

  it.each([
    ['заголовок отсутствует', undefined],
    ['схема не Bearer', 'Basic token'],
  ])('отвергает запрос, если %s', async (_name, header) => {
    const { service } = build({ foundUser: user() });

    await expect(service.authenticateUser(header)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('отвергает токен с посторонней полезной нагрузкой', async () => {
    const { service, jwtService } = build({ foundUser: user() });
    jwtService.verifyAsync.mockResolvedValue({ sub: 'not-an-object-id' });

    await expect(service.authenticateUser('Bearer token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('отвергает токен отключенной учетной записи', async () => {
    const { service } = build({ foundUser: null });

    await expect(service.authenticateUser('Bearer token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('текущий пользователь', () => {
  it('дополняет сведения названием кабинета', async () => {
    const { service } = build();

    const result = await service.getCurrentUser({
      id: USER_ID,
      workspaceId: WORKSPACE_ID,
      email: 'doc@example.com',
      name: 'Иван',
    });

    expect(result).toMatchObject({ workspaceName: 'Клиника', email: 'doc@example.com' });
  });

  it('сообщает об исчезнувшем кабинете', async () => {
    // Токен действителен, но кабинет удален: доступ прекращается, а не
    // оборачивается отказом 500 при обращении к отсутствующей записи.
    const { service } = build({ foundWorkspace: null });

    await expect(
      service.getCurrentUser({
        id: USER_ID,
        workspaceId: WORKSPACE_ID,
        email: 'doc@example.com',
        name: 'Иван',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
