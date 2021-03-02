'use strict';

import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from "fs";
import * as path from "path";
import * as junit2json from 'junit2json';
import { Commands } from './commands';
import { TestResult } from './testResult';
import { constants, ExecuteCommandsOn } from './constants';
import { outputChannel } from './ginkgoTestExplorer';

const coverageHTML = "coverage.html";
const coverageOut = "coverage.out";

export class GinkgoTest {
    private cwd: string;

    constructor(private ginkgoPath: string, private commands: Commands, private testEnvVars: {}, private testEnvFile: string, private executeCommandsOn: ExecuteCommandsOn, private workspaceFolder?: vscode.WorkspaceFolder) {
        this.cwd = '';
        if (workspaceFolder) {
            this.cwd = workspaceFolder.uri.fsPath;
        }
    };

    public setGinkgoPath(ginkgoPath: string) {
        this.ginkgoPath = ginkgoPath;
    }

    public setTestEnvVars(testEnvVars: {}) {
        this.testEnvVars = testEnvVars;
    }

    public setTestEnvFile(testEnvFile: string) {
        this.testEnvFile = testEnvFile;
    }

    public setExecuteCommandsOn(executeCommandsOn: ExecuteCommandsOn) {
        this.executeCommandsOn = executeCommandsOn;
    }

    public runGoTest(): string {
        const cwd = this.cwd;
        const coverageDir = this.prepareCoverageDir(cwd);
        const args = `test -coverpkg=./... -coverprofile=${coverageDir}/${coverageOut} -v -count=1 ./...`;
        return cp.spawnSync("go", args.split(" "), { cwd }).stdout.toString();
    }

    public async runTest(document?: vscode.TextDocument, spec?: string): Promise<TestResult[]> {
        let cwd = this.cwd;
        if (document) {
            cwd = path.dirname(document.fileName);
        }
        const reportFile = this.prepareReportFile(cwd);
        const coverageDir = this.prepareCoverageDir(cwd);

        const focus = (spec) ? `-focus "${spec}"` : "";
        const cover = `-cover -coverpkg=./... -coverprofile=${coverageDir}/${coverageOut}`;
        const report = `-reportFile ${reportFile}`;
        const command = `${this.ginkgoPath} ${report} ${focus} ${cover} -r ${cwd}`;
        if (this.executeCommandsOn === 'onTerminal') {
            let activeTerminal = vscode.window.terminals.find(t => t.name === "gte-bash");
            if (!activeTerminal) {
                activeTerminal = vscode.window.createTerminal({ name: "gte-bash", cwd });
            }
            if (activeTerminal) {
                activeTerminal.show(true);
                activeTerminal.sendText('', true);
                activeTerminal.sendText(`cd ${cwd} && ${command}`, true);
            }
        } else {
            new Promise<string>(async (resolve, reject) => {
                outputChannel.show(true);
                outputChannel.clear();
                outputChannel.appendLine(`${cwd}> ${command}`);
                try {
                    const output = cp.execSync(`cd ${cwd} && ${command}`, { cwd }).toString();
                    resolve(output);
                } catch (err) {
                    reject(err);
                }
            }).then(output => outputChannel.appendLine(output)).catch(err => outputChannel.appendLine(`Error: ${err}`));
        }
        const xml = await this.waitForReportFile(reportFile);
        const testResults: TestResult[] = await this.parseTestResults(xml);
        this.commands.sendTestResults(testResults);
        return testResults;
    }

    public async debugTest(document?: vscode.TextDocument, spec?: string): Promise<TestResult[]> {
        let cwd = this.cwd;
        if (document) {
            cwd = path.dirname(document.fileName);
        }
        const reportFile = this.prepareReportFile(cwd);

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
            env: this.testEnvVars || constants.defaultTestEnvVars,
            envFile: this.testEnvFile || constants.defaultTestEnvFile,
            args: debugArgs
        };
        let workspaceFolder = this.workspaceFolder;
        if (document) {
            workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        }
        await vscode.debug.startDebugging(workspaceFolder, debugConfig);

        const xml = await this.waitForReportFile(reportFile);
        const testResults: TestResult[] = await this.parseTestResults(xml);
        this.commands.sendTestResults(testResults);
        return testResults;
    }

    public generateCoverage(document?: vscode.TextDocument): string {
        let cwd = this.cwd;
        if (document) {
            cwd = path.dirname(document.fileName);
        }
        const coverageDir = path.normalize(path.join(cwd, 'coverage'));
        cp.execSync(`go tool cover -html=${coverageDir}/${coverageOut} -o ${coverageDir}/${coverageHTML}`, { cwd });
        return fs.readFileSync(`${coverageDir}/${coverageHTML}`, { encoding: 'utf8' });
    }

    public async checkGinkgoIsInstalled(ginkgoPath: string): Promise<boolean> {
        return await new Promise<boolean>(resolve => {
            cp.execFile(ginkgoPath, ['help'], {}, (err, stdout, stderr) => {
                if (err) {
                    return resolve(false);
                }
                return resolve(true);
            });
        });
    }

    public async callGinkgoInstall(): Promise<boolean> {
        return await new Promise<boolean>(resolve => {
            cp.execFile("go", ['get', 'github.com/onsi/ginkgo/ginkgo'], {}, (err, stdout, stderr) => {
                if (err) {
                    return resolve(false);
                }
                return resolve(true);
            });
        });
    }

    public async callGomegaInstall(): Promise<boolean> {
        return await new Promise<boolean>(resolve => {
            cp.execFile("go", ['get', 'github.com/onsi/gomega/...'], {}, (err, stdout, stderr) => {
                if (err) {
                    return resolve(false);
                }
                return resolve(true);
            });
        });
    }

    private async waitForReportFile(file: string): Promise<string> {
        return await new Promise(resolve => setInterval(function () {
            if (fs.existsSync(file)) {
                resolve(true);
            }
        }, 1000)).then(() => {
            // TODO: configure timeout and implements reject.
            return this.readReportFile(file);
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
            fs.mkdirSync(`${coverageDir}`, { recursive: true });
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