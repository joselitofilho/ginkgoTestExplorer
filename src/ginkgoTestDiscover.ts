'use strict';

import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from "fs";
import * as junit2json from 'junit2json';
import { TestResult } from './testResult';
import { Commands } from './commands';

export class GinkgoTestDiscover {

    constructor(public ginkgoPath: string, public cwd: string, private commands: Commands) { };

    public async runAllTests(): Promise<TestResult[]> {
        let testResults: TestResult[] = [];
        const xml = await this.callRunAllTest(this.ginkgoPath, this.cwd);
        const report = await junit2json.parse(xml) as junit2json.TestSuite;
        for (const tc of report.testcase) {
            const isSkipped = tc.skipped !== undefined;
            if (tc.failure !== undefined && tc.failure.length > 0) {
                testResults = [...testResults, new TestResult(tc.classname, tc.name, false, isSkipped, tc.failure[0].inner)];
            } else {
                testResults = [...testResults, new TestResult(tc.classname, tc.name, true, isSkipped)];
            }
        }
        this.commands.sendTestResult(testResults);
        return testResults;
    }

    private async callRunAllTest(ginkgoPath: string, cwd: string): Promise<string> {
        return await new Promise<string>((resolve, reject) => {
            const reportFile = cwd + "/ginkgo.report";
            const activeTerminal = vscode.window.activeTerminal;
            if (activeTerminal) {
                activeTerminal.show();
                activeTerminal.sendText('', true);
                activeTerminal.sendText(`${ginkgoPath} -reportFile ${reportFile} -r ${cwd}`, true);
                new Promise((resolve, reject) => setInterval(function () {
                    if (fs.existsSync(reportFile)) {
                        resolve(true);
                    }
                }, 1000)).then(() => {
                    // TODO: configure timeout and implements reject.
                    return resolve(this.readReportFile(reportFile));
                });
            } else {
                cp.execFile(ginkgoPath, ['-reportFile', reportFile, '-r', cwd], {}, (err, stdout, stderr) => {
                    return resolve(this.readReportFile(reportFile));
                });
            }
        });
    }

    private readReportFile(reportFile: string): string {
        const result = fs.readFileSync(reportFile, 'utf-8');
        fs.unlinkSync(reportFile);
        return result;
    }

}