import type { User, UserCredentials, UserPreferences } from '../entities/User';
import type { Email } from '../value-objects/Email';
import type { UserId } from '../value-objects/UserId';

export type CreateUserInput = {
  readonly email: Email;
  readonly displayName: string;
  readonly passwordHash: string;
};

export interface UserRepository {
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  findCredentialsByEmail(email: Email): Promise<UserCredentials | null>;
  create(input: CreateUserInput): Promise<User>;
  updateProfile(
    id: UserId,
    patch: { readonly displayName?: string; readonly avatarUrl?: string | null },
  ): Promise<User>;
  updatePreferences(id: UserId, preferences: UserPreferences): Promise<User>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
