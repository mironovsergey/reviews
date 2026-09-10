import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Workspace } from './workspace.schema';

/** Учетная запись консоли управления; принадлежит одному кабинету. */
@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ type: Types.ObjectId, ref: Workspace.name, required: true })
  workspaceId: Types.ObjectId;

  /** Логин консоли; служит и адресом для связи. */
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  /** Argon2id-хеш пароля от консоли управления. */
  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, trim: true })
  name: string;

  /**
   * Признак действующей записи. Проверяется при каждом опознании по токену,
   * поэтому отключение вступает в силу немедленно.
   */
  @Prop({ default: true })
  isActive: boolean;

  /** Отметка последнего успешного входа. */
  @Prop({ type: Date, default: null })
  lastLoginAt: Date | null;
}

export type UserDocument = HydratedDocument<User>;

export const UserSchema = SchemaFactory.createForClass(User);
