import { IO } from './index.ts';

export function createInMemoryIO(): IO {
  return {
    async ping() {
      return true;
    }
  };
}
