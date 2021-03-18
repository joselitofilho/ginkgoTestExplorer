'use strict';

import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from "fs";
import * as path from "path";
import * as junit2json from 'junit2json';
import { Commands } from './commands';
import { TestResult } from './testResult';
import { constants, ExecuteCommandsOn } from './constants';
import { affectsConfiguration, getConfiguration, outputChannel } from './ginkgoTestExplorer';
import { parseEnvFile } from './util/env';
import { resolvePath } from './util/fileSystem';

const coverageFolder = "coverage";
const coverageHTML = "coverage.html";
const coverageOut = "coverage.out";
const ginkgoReport = "ginkgo.report";
const gteBash = "gte-bash";

export class GinkgoTest {
    private cwd: string;
    private executeCommandsOn: ExecuteCommandsOn;
    private testEnvVars: {};
    private testEnvFile: string;

    constructor(private context: vscode.ExtensionContext, private ginkgoPath: string, private commands: Commands, private workspaceFolder?: vscode.WorkspaceFolder) {
        this.executeCommandsOn = getConfiguration().get('executeCommandsOn', constants.defaultExecuteCommandsOn);
        this.testEnvVars = getConfiguration().get('testEnvVars', constants.defaultTestEnvVars);
        this.testEnvFile = getConfiguration().get('testEnvFile', constants.defaultTestEnvFile);

        this.context.subscriptions.push(this.commands.checkGinkgoIsInstalledEmitter(this.checkGinkgoIsInstalled.bind(this), this));

        this.context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(evt => {
            if (affectsConfiguration(evt, 'ginkgoPath')) {
                this.setGinkgoPath(getConfiguration().get('ginkgoPath', constants.defaultGinkgoPath));
            }
            if (affectsConfiguration(evt, 'testEnvVars')) {
                this.setTestEnvVars(getConfiguration().get('testEnvVars', constants.defaultTestEnvVars));
            }
            if (affectsConfiguration(evt, 'testEnvFile')) {
                this.setTestEnvFile(getConfiguration().get('testEnvFile', constants.defaultTestEnvFile));
            }
            if (affectsConfiguration(evt, 'executeCommandsOn')) {
                this.setExecuteCommandsOn(getConfiguration().get('executeCommandsOn', constants.defaultExecuteCommandsOn));
            }
        }));
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

    public async runGoTestOnOutputChannel() {
        const cwd = this.cwd;
        const coverageDir = this.prepareCoverageDir(cwd);
        const outputTestFile = `${coverageDir}/${coverageOut}`;
        const command = `go test -coverpkg=./... -coverprofile=${outputTestFile} -count=1 ./...`;
        await this.execGoTestOnOutputChannel(command);
    }

    public async runGoTest() {
        const cwd = this.cwd;
        const coverageDir = this.prepareCoverageDir(cwd);
        const outputTestFile = `${coverageDir}/${coverageOut}`;
        const command = `go test -coverpkg=./... -coverprofile=${outputTestFile} -count=1 ./...`;

        if (this.executeCommandsOn === 'onTerminal') {
            let activeTerminal = vscode.window.terminals.find(t => t.name === gteBash);
            if (activeTerminal) {
                activeTerminal.dispose();
            }
            activeTerminal = vscode.window.createTerminal({ name: gteBash, cwd, env: this.getEnv() });
            if (activeTerminal) {
                activeTerminal.show(true);
                activeTerminal.sendText(`${command}`, true);
                outputChannel.appendLine(`Project tests running on the '${gteBash}' terminal.`);
            }
        } else {
            outputChannel.show(true);
            await this.execGoTestOnOutputChannel(command);
        }
    }

    public async runTest(spec: string, document?: vscode.TextDocument): Promise<TestResult[]> {
        let cwd = this.cwd;
        if (document) {
            cwd = path.dirname(document.fileName);
        }
        const reportFile = this.prepareReportFile(cwd);
        const coverageDir = this.prepareCoverageDir(cwd);

        const report = `-reportFile ${reportFile}`;
        const focus = `-focus "${spec}"`;
        const cover = `-cover -coverpkg=./... -coverprofile=${coverageDir}/${coverageOut}`;
        const command = `${this.ginkgoPath} ${report} ${focus} ${cover} -r`;
        let testResults: TestResult[] = [];
        if (this.executeCommandsOn === 'onTerminal') {
            let activeTerminal = vscode.window.terminals.find(t => t.name === gteBash);
            if (activeTerminal) {
                activeTerminal.dispose();
            }
            activeTerminal = vscode.window.createTerminal({ name: gteBash, cwd, env: this.getEnv() });
            if (activeTerminal) {
                activeTerminal.show(true);
                activeTerminal.sendText(`${command}`, true);

                const xml = await this.waitForReportFile(reportFile);
                testResults = await this.parseTestResults(xml);
            }
        } else {
            outputChannel.show(true);
            outputChannel.clear();
            outputChannel.appendLine(`${cwd}> ${command}`);
            try {
                await this.execCommand(command, cwd);
            } catch (err) {
                outputChannel.appendLine(`Error: "${spec}" failed.`);
                outputChannel.appendLine(err);
            }

            const xml = this.readReportFile(reportFile);
            testResults = await this.parseTestResults(xml);
        }
        this.commands.sendTestResults(testResults);
        return testResults;
    }

    public async debugTest(spec: string, document?: vscode.TextDocument): Promise<TestResult[]> {
        let cwd = this.cwd;
        if (document) {
            cwd = path.dirname(document.fileName);
        }

        outputChannel.clear();
        outputChannel.appendLine(`Running '${spec}' on debugging.`);

        const reportFile = this.prepareReportFile(cwd);
        const debugArgs: any = ['-ginkgo.debug', '-ginkgo.reportFile', reportFile, '-ginkgo.focus', spec];
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

    public async generateCoverage(document?: vscode.TextDocument): Promise<string> {
        let cwd = this.cwd;
        if (document) {
            cwd = path.dirname(document.fileName);
        }
        const coverageDir = path.normalize(path.join(cwd, coverageFolder));
        const command = `go tool cover -html=${coverageFolder}/${coverageOut} -o ${coverageDir}/${coverageHTML}`;
        outputChannel.appendLine(`${cwd}> ${command}`);
        await this.execCommand(command, cwd);
        return fs.readFileSync(`${coverageDir}/${coverageHTML}`, { encoding: 'utf8' });
    }

    public async checkGinkgoIsInstalled() {
        outputChannel.appendLine('Checking the Ginkgo executable was installed.');
        const isInstalled = await this.callGinkgoHelp();
        if (!isInstalled) {
            outputChannel.appendLine('Ginkgo executable was not found.');
            const action = await vscode.window.showInformationMessage('The Ginkgo executable was not found.', ...['Install']);
            if (action === 'Install') {
                outputChannel.show();
                outputChannel.appendLine('Installing Ginkgo and Gomega.');
                outputChannel.appendLine('go get github.com/onsi/ginkgo/ginkgo');
                outputChannel.appendLine('go get github.com/onsi/gomega/...');
                outputChannel.appendLine('Please wait...');
                let installed = await this.callGinkgoInstall();
                if (installed) {
                    outputChannel.appendLine('Ginkgo has been installed successfully.');
                    installed = await this.callGomegaInstall();
                    if (installed) {
                        outputChannel.appendLine('Gomega has been installed successfully.');
                    } else {
                        outputChannel.appendLine('Error installing Ginkgo and Gomega.');
                    }
                } else {
                    outputChannel.appendLine('Error installing Ginkgo and Gomega.');
                }
            }
        } else {
            outputChannel.appendLine('Ginkgo executable already installed. ;)');
        }
    }

    public async callGinkgoHelp(): Promise<boolean> {
        return await this.execCommand(`${this.ginkgoPath} help`, this.cwd, false);
    }

    public async callGinkgoInstall(): Promise<boolean> {
        return await this.execCommand('go get github.com/onsi/ginkgo/ginkgo', this.cwd);
    }

    public async callGomegaInstall(): Promise<boolean> {
        return await this.execCommand('go get github.com/onsi/gomega/...', this.cwd);
    }

    private getEnv(): { [key: string]: any } {
        const env: { [key: string]: any } = {};

        let envFile = this.testEnvFile || constants.defaultTestEnvFile;
        let fileEnv: { [key: string]: any } = {};
        if (envFile) {
            envFile = resolvePath(envFile);
            try {
                fileEnv = parseEnvFile(envFile);
            } catch (e) {
                console.log(e);
            }
        }
        Object.keys(fileEnv).forEach(
            (key) => (env[key] = typeof fileEnv[key] === 'string' ? resolvePath(fileEnv[key], this.cwd) : fileEnv[key])
        );

        const envVars: { [key: string]: any } = this.testEnvVars || constants.defaultTestEnvVars;
        Object.keys(envVars).forEach(
            (key) =>
            (env[key] =
                typeof envVars[key] === 'string' ? resolvePath(envVars[key], this.cwd) : envVars[key])
        );

        return env;
    }

    private async execGoTestOnOutputChannel(command: string) {
        const cwd = this.cwd;
        outputChannel.appendLine(`${cwd}> ${command}`);
        try {
            await this.execCommand(command, cwd);
            outputChannel.appendLine('Project tests have been run.');
        } catch (err) {
            outputChannel.appendLine(`Error: go test failed.`);
            outputChannel.appendLine(err);
        }
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
        const reportFile = `${cwd}/${ginkgoReport}`;
        if (fs.existsSync(reportFile)) {
            fs.unlinkSync(reportFile);
        }
        return reportFile;
    }

    private prepareCoverageDir(outputDir: string): string {
        const coverageDir = path.normalize(path.join(outputDir, coverageFolder));

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

    private async execCommand(command: string, cwd: string, showOutput: boolean | undefined = true): Promise<boolean> {
        return await new Promise<boolean>(async (resolve, reject) => {
            try {
                const commandSplit: string[] = command.split(" ");
                const tp = cp.spawn(commandSplit[0], commandSplit.slice(1), { shell: true, cwd });
                if (showOutput) {
                    tp.stdout.on('data', (chunk) => outputChannel.appendLine(chunk.toString()));
                }
                tp.on('close', code => resolve(code === 0));
            } catch (err) {
                if (showOutput) {
                    outputChannel.appendLine(err);
                }
                reject(err);
            }
        });
    }

}