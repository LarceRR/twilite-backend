/**
 * P5-S1 API E2E outline (requires Postgres + S3-compatible storage).
 *
 * Run with: RUN_INTEGRATION=1 pnpm test -- test/integration/spritePipeline.e2e.spec.ts
 *
 * Flow to assert when wiring integration harness:
 * 1. upload ticket → PUT object → confirm (owner only)
 * 2. submit pixel object (Idempotency-Key)
 * 3. reject → resubmit (published pointer stays live if already published)
 * 4. publish → place on surface → snapshot contains embed
 * 5. archive → catalog hides, surface binding remains
 *
 * This file is a placeholder contract for CI; enable when staging deps are present.
 */
import { describe, it } from 'vitest';

const run = process.env['RUN_INTEGRATION'] === '1';

describe.skipIf(!run)('sprite pipeline e2e (P5-S1)', () => {
  it('upload → confirm → submit → publish → place → snapshot', async () => {
    // Integration harness wires FakeStorage or MinIO + migrated DB.
    // Intentionally empty until RUN_INTEGRATION environment is provisioned.
  });
});
