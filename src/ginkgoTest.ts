'use strict';

import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from "fs";
import * as path from "path";
import * as junit2json from 'junit2json';
import { Commands } from './commands';
import { TestResult } from './testResult';

const coverageHTML = "coverage.html";
const coverageOut = "coverage.out";

export class GinkgoTest {

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

    public generateCoverage(): string {
        const coverageDir = path.normalize(path.join(this.cwd, 'coverage'));
        cp.execSync(`go tool cover -html=${coverageDir}/${coverageOut} -o ${coverageDir}/${coverageHTML}`, { cwd: this.cwd });
        return fs.readFileSync(`${coverageDir}/${coverageHTML}`, { encoding: 'utf8' });
    }

    public async checkGinkgoIsInstalled(ginkgoPath: string): Promise<boolean> {
        return await new Promise<boolean>((resolve, reject) => {
            cp.execFile(ginkgoPath, ['help'], {}, (err, stdout, stderr) => {
                if (err) {
                    return resolve(false);
                }
                return resolve(true);
            });
        });
    }
    
    public async callGinkgoInstall(): Promise<boolean> {
        return await new Promise<boolean>((resolve, reject) => {
            cp.execFile("go", ['get', 'github.com/onsi/ginkgo/ginkgo'], {}, (err, stdout, stderr) => {
                if (err) {
                    return resolve(false);
                }
                return resolve(true);
            });
        });
    }
    
    public async callGomegaInstall(): Promise<boolean> {
        return await new Promise<boolean>((resolve, reject) => {
            cp.execFile("go", ['get', 'github.com/onsi/gomega/...'], {}, (err, stdout, stderr) => {
                if (err) {
                    return resolve(false);
                }
                return resolve(true);
            });
        });
    }

    private async callRunTest(ginkgoPath: string, cwd: string, spec?: string): Promise<string> {
        return await new Promise((resolve, reject) => {
            const coverageDir = path.normalize(path.join(cwd, 'coverage'));
            this.prepareCoverageDir(coverageDir);

            const focus = (spec) ? `-focus "${spec}"` : "";
            const cover = `-cover -coverpkg=./... -coverprofile=${coverageDir}/${coverageOut}`;

            const reportFile = cwd + "/ginkgo.report";
            if (fs.existsSync(reportFile)) {
                fs.unlinkSync(reportFile);
            }

            const command = `${ginkgoPath} -reportFile ${reportFile} ${focus} ${cover} -r ${cwd}`;

            let activeTerminal = vscode.window.activeTerminal;
            if (!activeTerminal) {
                activeTerminal = vscode.window.createTerminal({ cwd });
            }
            if (activeTerminal) {
                activeTerminal.show();
                activeTerminal.sendText('', true);
                activeTerminal.sendText(command, true);
                new Promise((resolveInterval, rejectInterval) => setInterval(function () {
                    if (fs.existsSync(reportFile)) {
                        resolveInterval(true);
                    }
                }, 1000)).then(() => {
                    // TODO: configure timeout and implements reject.
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

    private prepareCoverageDir(outputDir: string) {
        if (!fs.existsSync(`${outputDir}`)) {
            fs.mkdirSync(`${outputDir}`);
        } else {
            if (fs.existsSync(`${outputDir}/${coverageHTML}`)) {
                fs.unlinkSync(`${outputDir}/${coverageHTML}`);
            }
    
            if (fs.existsSync(`${outputDir}/${coverageOut}`)) {
                fs.unlinkSync(`${outputDir}/${coverageOut}`);
            }
        }
    }

}