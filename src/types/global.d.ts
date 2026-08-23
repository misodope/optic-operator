import type { OpticOperatorApi } from './index';

declare global {
  interface Window {
    opticOperator: OpticOperatorApi;
  }
}

export {};
