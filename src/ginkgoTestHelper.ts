import * as cp from 'child_process';

export async function checkGinkgoIsInstalled(ginkgoPath: string): Promise<boolean> {
    return await new Promise<boolean>((resolve, reject) => {
        cp.execFile(ginkgoPath, ['help'], {}, (err, stdout, stderr) => {
            if (err) {
                return resolve(false);
            }
            return resolve(true);
        });
    });
}

export async function callGinkgoInstall(): Promise<boolean> {
    return await new Promise<boolean>((resolve, reject) => {
        cp.execFile("go", ['get', 'github.com/onsi/ginkgo/ginkgo'], {}, (err, stdout, stderr) => {
            if (err) {
                return resolve(false);
            }
            return resolve(true);
        });
    });
}

export async function callGomegaInstall(): Promise<boolean> {
    return await new Promise<boolean>((resolve, reject) => {
        cp.execFile("go", ['get', 'github.com/onsi/gomega/...'], {}, (err, stdout, stderr) => {
            if (err) {
                return resolve(false);
            }
            return resolve(true);
        });
    });
}