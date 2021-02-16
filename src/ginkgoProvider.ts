'use strict';

import * as vscode from 'vscode';
import * as cp from 'child_process';

import * as path from "path";
import * as fs from "fs";
const { readdir } = require('fs').promises;

export class GinkgoProvider {

    constructor(public ginkgoPath: string, public cwd: string) { };

    public async runAllTests(): Promise<String> {
        let output: string = await callGinkgoBuildAllTests(this.ginkgoPath, this.cwd);
        let files: string[] = [];
        await callGetAllTestFiles(this.cwd).then(res => {
            files = res
        })
        for (const file of files) {
            // output += ` f: ${file} `
            output += await callRunTest(file);
        }
        return output;
    }

}

export async function callGinkgoBuildAllTests(ginkgoPath: string, cwd: string): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
        cp.execFile('ginkgo', ['build', '-cover', './...'], { cwd: cwd }, (err, stdout, stderr) => {
            if (err) {
                let msg = `error running "${err.cmd}"`;
                if (err.code) {
                    msg += ` (error code ${err.code})`;
                }
                if (stderr) {
                    msg += `: ${stderr}`;
                }
                return reject(new Error(msg));
            }
            const result = stdout.toString();
            return resolve(result);
        });
    });
}

export default async function callGetAllTestFiles(directory: string) {
    let fileList: string[] = [];

    const files = await readdir(directory);
    for (const file of files) {
        const p = path.join(directory, file);
        if (fs.statSync(p).isDirectory()) {
            fileList = [...fileList, ...(await callGetAllTestFiles(p))];
        } else if (path.extname(p) == ".test") {
            fileList.push(p);
        }
    }

    return fileList;
}

export async function callRunTest(execFile: string): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
        const reportFile = execFile.replace(".test", ".report")
        cp.execFile(execFile, ['-ginkgo.reportFile', reportFile], {}, (err, stdout, stderr) => {
            if (err) {
                let msg = `error running "${err.cmd}"`;
                if (err.code) {
                    msg += ` (error code ${err.code})`;
                }
                if (stderr) {
                    msg += `: ${stderr}`;
                }
                return reject(new Error(msg));
            }
            const result = stdout.toString();
            return resolve(result);
        });
    });
}