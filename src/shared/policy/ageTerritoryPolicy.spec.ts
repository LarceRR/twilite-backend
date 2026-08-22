import { describe, expect, it, vi } from 'vitest';

import { ErrorCode } from '@/shared/errors/AppError';
import { DomainError } from '@/shared/errors';

import {
  AGE_TERRITORY_POLICY,
  type AgeTerritoryPolicy,
  assertEligible,
  decideEligibility,
  fullYearsSince,
} from './ageTerritoryPolicy';

const policy: AgeTerritoryPolicy = AGE_TERRITORY_POLICY;
const utc = (value: string): Date => new Date(`${value}T12:00:00.000Z`);

describe('возрастная и территориальная политика (#41)', () => {
  it('является версионируемой и внутренне согласованной', () => {
    expect(policy.version).not.toBe('');
    expect(policy.minimumAgeYears).toBeGreaterThanOrEqual(13);
    expect(policy.supportedTerritories.length).toBeGreaterThan(0);
    for (const territory of policy.supportedTerritories) expect(territory).toMatch(/^[A-Z]{2}$/);
  });

  it('пропускает ровно в день достижения порога', () => {
    const birthDate = '2010-08-09';

    expect(decideEligibility({ birthDate, territory: 'RU' }, utc('2026-08-09'))).toEqual({
      allowed: true,
      policyVersion: policy.version,
      ageYears: 16,
      territory: 'RU',
    });
  });

  it('отказывает за день до дня рождения', () => {
    const decision = decideEligibility(
      { birthDate: '2010-08-09', territory: 'RU' },
      utc('2026-08-08'),
    );

    expect(decision).toEqual({
      allowed: false,
      policyVersion: policy.version,
      reason: 'below_minimum_age',
    });
  });

  it('корректно считает возраст для 29 февраля', () => {
    expect(fullYearsSince('2008-02-29', utc('2024-02-28'))).toBe(15);
    expect(fullYearsSince('2008-02-29', utc('2024-02-29'))).toBe(16);
    expect(fullYearsSince('2008-02-29', utc('2025-03-01'))).toBe(17);
  });

  it.each([
    ['', 'missing_age_declaration'],
    ['   ', 'missing_age_declaration'],
    ['09.08.2010', 'invalid_age_declaration'],
    ['2010-13-05', 'invalid_age_declaration'],
    ['2026-02-30', 'invalid_age_declaration'],
    ['2010-04-31', 'invalid_age_declaration'],
    ['2030-01-01', 'invalid_age_declaration'],
  ])('отклоняет декларацию возраста %s как %s', (birthDate, reason) => {
    const decision = decideEligibility({ birthDate, territory: 'RU' }, utc('2026-08-09'));

    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.reason).toBe(reason);
  });

  it('не требует декларации возраста при отсутствии поля', () => {
    const decision = decideEligibility({ territory: 'RU' }, utc('2026-08-09'));

    expect(decision).toEqual({
      allowed: false,
      policyVersion: policy.version,
      reason: 'missing_age_declaration',
    });
  });

  it('нормализует регистр территории', () => {
    const decision = decideEligibility(
      { birthDate: '2000-01-01', territory: ' ru ' },
      utc('2026-08-09'),
    );

    expect(decision.allowed).toBe(true);
    expect(decision.allowed === true && decision.territory).toBe('RU');
  });

  it.each([
    ['DE', 'unsupported_territory'],
    ['US', 'unsupported_territory'],
    ['RUS', 'unsupported_territory'],
    ['', 'missing_territory_declaration'],
  ])('обрабатывает территорию %s как %s', (territory, reason) => {
    const decision = decideEligibility({ birthDate: '2000-01-01', territory }, utc('2026-08-09'));

    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.reason).toBe(reason);
  });

  it('не раскрывает дату рождения в решении', () => {
    const decision = decideEligibility(
      { birthDate: '2019-05-17', territory: 'RU' },
      utc('2026-08-09'),
    );

    expect(JSON.stringify(decision)).not.toContain('2019-05-17');
  });

  it('отказ приходит стабильным кодом DOMAIN_RULE_VIOLATION', () => {
    try {
      assertEligible({ birthDate: '2019-05-17', territory: 'RU' }, utc('2026-08-09'));
      expect.unreachable('политика должна отклонить регистрацию');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe(ErrorCode.DOMAIN_RULE_VIOLATION);
      expect((error as DomainError).httpStatus).toBe(422);
      expect(JSON.stringify((error as DomainError).toPublicJson())).not.toContain('2019-05-17');
    }
  });

  /**
   * Главный инвариант приватности: пока проверка не пройдена, о пользователе
   * ничего не создаётся и никуда не отправляется.
   */
  it('не создаёт профиль и не отправляет аналитику до прохождения проверки', () => {
    const createProfile = vi.fn();
    const trackAnalytics = vi.fn();
    const storeConsent = vi.fn();

    const register = (birthDate: string, territory: string): void => {
      assertEligible({ birthDate, territory }, utc('2026-08-09'));
      createProfile();
      storeConsent();
      trackAnalytics();
    };

    expect(() => register('2019-05-17', 'RU')).toThrow(DomainError);
    expect(createProfile).not.toHaveBeenCalled();
    expect(storeConsent).not.toHaveBeenCalled();
    expect(trackAnalytics).not.toHaveBeenCalled();

    expect(() => register('2000-01-01', 'RU')).not.toThrow();
    expect(createProfile).toHaveBeenCalledTimes(1);
  });

  it('позволяет прогнать альтернативную версию политики без правки кода вызова', () => {
    const wider: AgeTerritoryPolicy = {
      version: 'test.2',
      minimumAgeYears: 18,
      supportedTerritories: ['RU', 'KZ'],
      restrictedMode: 'none',
    };

    expect(
      decideEligibility({ birthDate: '2010-01-01', territory: 'KZ' }, utc('2026-08-09'), wider),
    ).toEqual({
      allowed: false,
      policyVersion: 'test.2',
      reason: 'below_minimum_age',
    });
    expect(
      decideEligibility({ birthDate: '2000-01-01', territory: 'KZ' }, utc('2026-08-09'), wider)
        .allowed,
    ).toBe(true);
  });
});
