import type { Email } from '../value-objects/Email';
import type { UserId } from '../value-objects/UserId';

export type UserPreferences = {
  readonly locale: string;
  readonly soundEnabled: boolean;
  readonly hapticsEnabled: boolean;
  readonly reduceMotion: boolean;
  readonly pushEnabled: boolean;
};

export const defaultPreferences: UserPreferences = {
  locale: 'ru',
  soundEnabled: true,
  hapticsEnabled: true,
  reduceMotion: false,
  pushEnabled: true,
};

export type User = {
  readonly id: UserId;
  readonly email: Email;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly preferences: UserPreferences;
  readonly createdAt: Date;
};

/** Credentials live next to the user but never travel with the profile. */
export type UserCredentials = {
  readonly userId: UserId;
  readonly passwordHash: string;
};
