// Special Transport types - umbrella type for all special vehicles

import type { DollySemiResult } from './dolly-semi';
import type { ModularTimberResult } from './modular-timber';
import type { SemiStandardResult } from './semi-standard';

export type SpecialTransportVariant = 'dolly' | 'modular' | 'standard';

export type SpecialTransportResult = {
  variant: SpecialTransportVariant;
  data: DollySemiResult | ModularTimberResult | SemiStandardResult;
};

export type SpecialTransportNote = {
  type: 'info' | 'warning' | 'error';
  message: string;
};
