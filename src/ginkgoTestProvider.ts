'use strict';

import * as vscode from 'vscode';
import * as cp from 'child_process';

import * as path from "path";
import * as fs from "fs";
const { readdir } = require('fs').promises;

import  * as junit2json from 'junit2json'
import { TestResult } from './testResult';

export class GinkgoTestProvider {

    constructor(public ginkgoPath: string, public cwd: string) { };

    public async runAllTests(): Promise<TestResult[]> {
        await callGinkgoBuildAllTests(this.ginkgoPath, this.cwd);
        const files = await callGetAllTestFiles(this.cwd)
        let output: TestResult[] = [];
        for (const file of files) {
            const xml = await callRunTest(file);
            const report = await junit2json.parse(xml) as junit2json.TestSuite
            for (const tc of report.testcase) {
                const isSkipped = tc.skipped !== undefined;
                if (tc.failure !== undefined && tc.failure.length > 0) {
                    output = [...output, new TestResult(tc.classname, tc.name, false, isSkipped, tc.failure[0].inner)]
                } else {
                    output = [...output, new TestResult(tc.classname, tc.name, true, isSkipped)]
                }
            }
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
            const result = fs.readFileSync(reportFile, 'utf-8');
            fs.unlinkSync(reportFile)
            fs.unlinkSync(execFile)
            return resolve(result);
        });
    });
}