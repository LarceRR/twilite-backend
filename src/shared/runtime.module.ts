import { Global, Module } from '@nestjs/common';

import { CLOCK, systemClock } from './utils/clock';
import { ID_GENERATOR, uuidGenerator } from './utils/id';
import { cryptoRandomSource, RANDOM_SOURCE } from './utils/random';

/** Process-wide infrastructure seams available to every feature module. */
@Global()
@Module({
  providers: [
    { provide: CLOCK, useValue: systemClock },
    { provide: ID_GENERATOR, useValue: uuidGenerator },
    { provide: RANDOM_SOURCE, useValue: cryptoRandomSource },
  ],
  exports: [CLOCK, ID_GENERATOR, RANDOM_SOURCE],
})
export class RuntimeModule {}
