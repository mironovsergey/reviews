import type { Request } from 'express';
import type { Types } from 'mongoose';

/** Пользователь, распознанный по JWT и подтвержденный записью в базе. */
export interface AuthenticatedUser {
  id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  email: string;
  name: string;
}

export interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}
