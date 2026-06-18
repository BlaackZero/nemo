import * as path from 'path';
import { glob } from 'glob';

// CommonJS export works reliably with @types/mocha in extension test runners.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Mocha = require('mocha') as typeof import('mocha');

export function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
  });

  const testsRoot = path.resolve(__dirname, '..');

  return new Promise((resolve, reject) => {
    glob('**/**.test.js', { cwd: testsRoot })
      .then((files) => {
        files.forEach((file) => mocha.addFile(path.resolve(testsRoot, file)));
        try {
          mocha.run((failures: number) => {
            if (failures > 0) {
              reject(new Error(`${failures} tests failed.`));
            } else {
              resolve();
            }
          });
        } catch (error) {
          reject(error);
        }
      })
      .catch((error) => reject(error));
  });
}
