// Errors raised by the helper's scraping modules.
//
// Carries the shared `SearchErrorType` so a caught error maps straight onto
// the wire contract's `SearchError` (ticket 06's progress payload).
import { ERROR_MESSAGES } from '../../src/core/errors.js';
import type { SearchErrorType } from '../../src/core/types.js';

export class ScanSearchError extends Error {
  constructor(
    readonly type: SearchErrorType,
    message?: string,
  ) {
    super(message ?? ERROR_MESSAGES[type]);
    this.name = 'ScanSearchError';
  }
}
