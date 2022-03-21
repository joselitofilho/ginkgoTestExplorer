import * as cp from 'child_process';

export async function detectGinkgoMajorVersion(ginkgoPath: string): Promise<number> {
  return new Promise<number>(async (resolve, reject) => {
      try {
          const tp = cp.spawn(ginkgoPath, ["version"], { shell: true });
          let result = "";
          tp.stdout.on('data', (chunk) => result += chunk.toString());
          tp.on('close', code => {
              if (code !== 0) {
                  reject(new Error(`Failed to detect ginkgo version ${code}`));
              }

              const match = result.match(/([0-9]+)\.([0-9]+)\.([0-9]+)/);
              if (match) {
                  const majorVersion = parseInt(match[1], 10);
                  resolve(!isNaN(majorVersion) ? majorVersion : 1);
              }
              resolve(1);
          });
      } catch (err) {
          reject(err);
      }
  });
}