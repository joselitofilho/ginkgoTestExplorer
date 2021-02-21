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
    private cwd: string;

    constructor(private ginkgoPath: string, private commands: Commands, private workspaceFolder?: vscode.WorkspaceFolder) {
        this.cwd = '';
        if (workspaceFolder) {
            this.cwd = workspaceFolder.uri.fsPath;
        }
    };

    public setGinkgoPath(ginkgoPath: string) {
        this.ginkgoPath = ginkgoPath;
    }

    public async runTest(spec?: string): Promise<TestResult[]> {
        const cwd = this.cwd;
        const reportFile = this.prepareReportFile(cwd);
        const coverageDir = this.prepareCoverageDir(cwd);

        let activeTerminal = vscode.window.activeTerminal;
        if (!activeTerminal) {
            activeTerminal = vscode.window.createTerminal({ cwd });
        }
        if (activeTerminal) {
            const focus = (spec) ? `-focus "${spec}"` : "";
            const cover = `-cover -coverpkg=./... -coverprofile=${coverageDir}/${coverageOut}`;
            const command = `${this.ginkgoPath} -reportFile ${reportFile} ${focus} ${cover} -r ${cwd}`;
            activeTerminal.show();
            activeTerminal.sendText('', true);
            activeTerminal.sendText(command, true);
        }

        const xml = await this.waitForReportFile(reportFile);
        const testResults: TestResult[] = await this.parseTestResults(xml);
        this.commands.sendTestResults(testResults);
        return testResults;
    }

    public async debugTest(document?: vscode.TextDocument, spec?: string): Promise<TestResult[]> {
        const cwd = this.cwd;
        const reportFile = this.prepareReportFile(cwd);

        let workspaceFolder = this.workspaceFolder;
        if (document) {
            workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        }

        let debugArgs: any = [];
        if (spec) {
            debugArgs = ['-ginkgo.debug', '-ginkgo.reportFile', reportFile, '-ginkgo.focus', spec];
        }

        const debugConfig: vscode.DebugConfiguration = {
            name: `Debug Test ${document?.fileName}`,
            type: 'go',
            request: 'launch',
            mode: 'auto',
            program: document?.fileName,
            args: debugArgs,
            // env: [],
            // envFile: [],
        };
        await vscode.debug.startDebugging(workspaceFolder, debugConfig);

        const xml = await this.waitForReportFile(reportFile);
        const testResults: TestResult[] = await this.parseTestResults(xml);
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

    private async waitForReportFile(reportFile: string): Promise<string> {
        return await new Promise((resolveInterval, rejectInterval) => setInterval(function () {
            if (fs.existsSync(reportFile)) {
                resolveInterval(true);
            }
        }, 1000)).then(() => {
            // TODO: configure timeout and implements reject.
            return this.readReportFile(reportFile);
        });
    }

    private readReportFile(reportFile: string): string {
        const result = fs.readFileSync(reportFile, 'utf-8');
        if (fs.existsSync(reportFile)) {
            fs.unlinkSync(reportFile);
        }
        return result;
    }

    private async parseTestResults(xml: string) {
        let testResults: TestResult[] = [];
        const report = await junit2json.parse(xml) as junit2json.TestSuite;
        for (const tc of report.testcase) {
            const isSkipped = tc.skipped !== undefined;
            if (tc.failure !== undefined && tc.failure.length > 0) {
                testResults = [...testResults, new TestResult(tc.classname, tc.name, false, isSkipped, tc.failure[0].inner)];
            } else {
                testResults = [...testResults, new TestResult(tc.classname, tc.name, true, isSkipped)];
            }
        }
        return testResults;
    }

    private prepareReportFile(cwd: string): string {
        const reportFile = cwd + "/ginkgo.report";
        if (fs.existsSync(reportFile)) {
            fs.unlinkSync(reportFile);
        }
        return reportFile;
    }

    private prepareCoverageDir(outputDir: string): string {
        const coverageDir = path.normalize(path.join(outputDir, 'coverage'));

        if (!fs.existsSync(`${coverageDir}`)) {
            fs.mkdirSync(`${coverageDir}`);
        } else {
            if (fs.existsSync(`${coverageDir}/${coverageHTML}`)) {
                fs.unlinkSync(`${coverageDir}/${coverageHTML}`);
            }

            if (fs.existsSync(`${coverageDir}/${coverageOut}`)) {
                fs.unlinkSync(`${coverageDir}/${coverageOut}`);
            }
        }

        return coverageDir;
    }

}