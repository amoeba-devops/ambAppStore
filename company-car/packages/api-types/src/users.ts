import { z } from 'zod';
import { LanguageEnum, RoleEnum, UserStatusEnum } from './enums';

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().min(1).max(200),
  position: z.string().max(200).nullable(),
  role: RoleEnum,
  language: LanguageEnum,
  status: UserStatusEnum,
  ssoProvider: z.string().nullable(),
  ssoId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  fullName: z.string().min(1).max(200),
  position: z.string().max(200).optional(),
  role: RoleEnum,
  language: LanguageEnum.default('en'),
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = CreateUserSchema.partial().omit({ password: true });
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const MobileLoginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: UserSchema,
});
export type MobileLoginResponse = z.infer<typeof MobileLoginResponseSchema>;
