import { DomainError } from '@/shared/errors';

/**
 * Возрастная и территориальная политика (issue #41).
 *
 * Политика версионируется вместе с Terms и Privacy: любое изменение порога или
 * списка территорий — это новая версия и обновление опубликованных документов
 * (#70), а не правка значения на месте.
 *
 * Решение принимает бэкенд. Клиент собирает декларацию, но не решает: ниже
 * порога или вне поддерживаемой территории профиль, consent и события аналитики
 * не создаются вообще (см. docs/age-territory-policy.md и #80).
 */

export const AGE_TERRITORY_POLICY_VERSION = '2026-08-09.1';

export type AgeTerritoryPolicy = {
  readonly version: string;
  readonly minimumAgeYears: number;
  /** ISO 3166-1 alpha-2, верхний регистр. */
  readonly supportedTerritories: readonly string[];
  /**
   * `none` — ниже порога доступ запрещён полностью. Отдельного «детского режима»
   * в MVP нет: он потребовал бы обработки данных ребёнка, которую мы не хотим.
   */
  readonly restrictedMode: 'none';
};

export const AGE_TERRITORY_POLICY: AgeTerritoryPolicy = {
  version: AGE_TERRITORY_POLICY_VERSION,
  minimumAgeYears: 16,
  supportedTerritories: ['RU'],
  restrictedMode: 'none',
};

export type EligibilityDenialReason =
  | 'missing_age_declaration'
  | 'invalid_age_declaration'
  | 'below_minimum_age'
  | 'missing_territory_declaration'
  | 'unsupported_territory';

/**
 * Отказ несёт только причину и версию политики. Дата рождения и любые другие
 * персональные значения в решение, ответ API и телеметрию не попадают.
 */
export type EligibilityDecision =
  | {
      readonly allowed: true;
      readonly policyVersion: string;
      readonly ageYears: number;
      readonly territory: string;
    }
  | {
      readonly allowed: false;
      readonly policyVersion: string;
      readonly reason: EligibilityDenialReason;
    };

export type EligibilityDeclaration = {
  /** Календарная дата в формате `YYYY-MM-DD`. Время и таймзона не запрашиваются. */
  readonly birthDate?: string | null;
  /** ISO 3166-1 alpha-2; регистр не важен. */
  readonly territory?: string | null;
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TERRITORY = /^[A-Z]{2}$/;
const MAX_PLAUSIBLE_AGE_YEARS = 120;

/**
 * Полные годы на момент `now`. `undefined` означает, что дата не является
 * настоящей календарной датой, либо лежит в будущем, либо неправдоподобна.
 *
 * Сравнение идёт по UTC-компонентам: возрастной порог — календарное правило, и
 * он не должен зависеть от таймзоны сервера.
 */
export function fullYearsSince(birthDate: string, now: Date): number | undefined {
  const match = ISO_DATE.exec(birthDate.trim());

  if (match === null) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;

  // Отсекает 31 апреля и 29 февраля невисокосного года: нормализация сдвинула бы дату.
  const asUtc = new Date(Date.UTC(year, month - 1, day));

  if (
    asUtc.getUTCFullYear() !== year ||
    asUtc.getUTCMonth() !== month - 1 ||
    asUtc.getUTCDate() !== day
  ) {
    return undefined;
  }

  let years = now.getUTCFullYear() - year;
  const monthDelta = now.getUTCMonth() - (month - 1);

  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < day)) years -= 1;

  if (years < 0 || years > MAX_PLAUSIBLE_AGE_YEARS) return undefined;

  return years;
}

/**
 * Единственная точка принятия решения. Вызывается до создания пользователя,
 * записи consent и любого события аналитики.
 */
export function decideEligibility(
  declaration: EligibilityDeclaration,
  now: Date,
  policy: AgeTerritoryPolicy = AGE_TERRITORY_POLICY,
): EligibilityDecision {
  const deny = (reason: EligibilityDenialReason): EligibilityDecision => ({
    allowed: false,
    policyVersion: policy.version,
    reason,
  });

  const birthDate = declaration.birthDate?.trim() ?? '';

  if (birthDate === '') return deny('missing_age_declaration');

  const ageYears = fullYearsSince(birthDate, now);

  if (ageYears === undefined) return deny('invalid_age_declaration');
  if (ageYears < policy.minimumAgeYears) return deny('below_minimum_age');

  const territory = declaration.territory?.trim().toUpperCase() ?? '';

  if (territory === '') return deny('missing_territory_declaration');
  if (!TERRITORY.test(territory)) return deny('unsupported_territory');
  if (!policy.supportedTerritories.includes(territory)) return deny('unsupported_territory');

  return { allowed: true, policyVersion: policy.version, ageYears, territory };
}

/**
 * Отказ — нарушение доменного правила: `422 DOMAIN_RULE_VIOLATION`. Это не 403:
 * пользователь не «не авторизован», он не подходит под политику продукта.
 */
export function assertEligible(
  declaration: EligibilityDeclaration,
  now: Date,
  policy: AgeTerritoryPolicy = AGE_TERRITORY_POLICY,
): void {
  const decision = decideEligibility(declaration, now, policy);

  if (decision.allowed) return;

  throw new DomainError('Регистрация недоступна по возрастной или территориальной политике', {
    policyVersion: decision.policyVersion,
    reason: decision.reason,
  });
}
