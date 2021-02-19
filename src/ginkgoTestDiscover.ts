'use strict';

import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from "fs";
import * as junit2json from 'junit2json';
import { Commands } from './commands';
import { TestResult } from './testResult';

export class GinkgoTestDiscover {

    constructor(private ginkgoPath: string, public cwd: string, private commands: Commands) { };

    public setGinkgoPath(ginkgoPath: string) {
        this.ginkgoPath = ginkgoPath;
    }

    public async runAllTest(spec?: string): Promise<TestResult[]> {
        let testResults: TestResult[] = [];
        const xml = await this.callRunTest(this.ginkgoPath, this.cwd, spec);
        const report = await junit2json.parse(xml) as junit2json.TestSuite;
        for (const tc of report.testcase) {
            const isSkipped = tc.skipped !== undefined;
            if (tc.failure !== undefined && tc.failure.length > 0) {
                testResults = [...testResults, new TestResult(tc.classname, tc.name, false, isSkipped, tc.failure[0].inner)];
            } else {
                testResults = [...testResults, new TestResult(tc.classname, tc.name, true, isSkipped)];
            }
        }
        this.commands.sendTestResults(testResults);
        return testResults;
    }

    private async callRunTest(ginkgoPath: string, cwd: string, spec?: string): Promise<string> {
        return await new Promise<string>((resolve, reject) => {
            const focus = (spec) ? `-focus "${spec}"` : "";
            const reportFile = cwd + "/ginkgo.report";
            if (fs.existsSync(reportFile)) {
                fs.unlinkSync(reportFile);
            }
            const activeTerminal = vscode.window.activeTerminal;
            if (activeTerminal) {
                activeTerminal.show();
                activeTerminal.sendText('', true);
                activeTerminal.sendText(`${ginkgoPath} -reportFile ${reportFile} ${focus} -r ${cwd}`, true);
                new Promise((rresolve, rreject) => setInterval(function () {
                    if (fs.existsSync(reportFile)) {
                        rresolve(true);
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
        if (fs.existsSync(reportFile)) {
            fs.unlinkSync(reportFile);
        }
        return result;
    }

}