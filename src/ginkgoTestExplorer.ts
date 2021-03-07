'use strict';

import * as vscode from 'vscode';
import * as symbolPicker from './symbolPicker';
import { GinkgoTestTreeDataExplorer } from './ginkgoTestTreeDataProvider';
import { GinkgoTestFilesExplorer } from './ginkgoTestFilesTreeDataProvider';
import { GinkgoOutline, GinkgoOutliner } from './ginkgoOutliner';
import { CachingOutliner } from './cachingOutliner';
import { Commands } from './commands';
import { constants } from './constants';
import { GinkgoRunTestCodeLensProvider } from './ginkgoRunTestCodelensProvider';
import { GinkgoNode } from './ginkgoNode';
import { GinkgoTest } from './ginkgoTest';
import { StatusBar } from './statusBar';

export function getConfiguration(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(constants.extensionName);
}

export function affectsConfiguration(evt: vscode.ConfigurationChangeEvent, name: string): boolean {
    return evt.affectsConfiguration(`${constants.extensionName}.${name}`);
}

export let outputChannel: vscode.OutputChannel;

export class GinkgoTestExplorer {

    private cachingOutliner: CachingOutliner;
    private testTreeDataExplorer: GinkgoTestTreeDataExplorer;
    private outliner: GinkgoOutliner;
    private statusBar: StatusBar;
    private ginkgoPath: string;
    private ginkgoTest: GinkgoTest;

    readonly commands: Commands;
    constructor(context: vscode.ExtensionContext) {
        this.commands = new Commands();
        outputChannel = vscode.window.createOutputChannel(constants.displayName);
        context.subscriptions.push(outputChannel);
        outputChannel.appendLine('Welcome to Ginkgo Explorer');

        this.ginkgoPath = getConfiguration().get('ginkgoPath', constants.defaultGinkgoPath);
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(evt => {
            if (affectsConfiguration(evt, 'ginkgoPath')) {
                this.ginkgoPath = getConfiguration().get('ginkgoPath', constants.defaultGinkgoPath);
            }
        }));

        let workspaceFolder: vscode.WorkspaceFolder | undefined;
        if (vscode.workspace.workspaceFolders) {
            workspaceFolder = vscode.workspace.workspaceFolders[0];
        }

        this.ginkgoTest = new GinkgoTest(context, this.ginkgoPath, this.commands, getConfiguration().get('testEnvVars', constants.defaultTestEnvVars), getConfiguration().get('testEnvFile', constants.defaultTestEnvFile), getConfiguration().get('executeCommandsOn', constants.defaultExecuteCommandsOn), workspaceFolder);

        context.subscriptions.push(this.commands.checkGinkgoIsInstalledEmitter(this.onCheckGinkgoIsInstalledEmitter.bind(this), this));

        this.outliner = new GinkgoOutliner(this.ginkgoPath, this.commands);
        this.cachingOutliner = new CachingOutliner(this.outliner, getConfiguration().get('cacheTTL', constants.defaultCacheTTL));
        context.subscriptions.push({ dispose: () => { this.cachingOutliner.clear(); } });
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(evt => {
            if (affectsConfiguration(evt, 'ginkgoPath')) {
                this.outliner.setGinkgoPath(getConfiguration().get('ginkgoPath', constants.defaultGinkgoPath));
                this.cachingOutliner.setOutliner(this.outliner);
            }
            if (affectsConfiguration(evt, 'cacheTTL')) {
                this.cachingOutliner.setCacheTTL(getConfiguration().get('cacheTTL', constants.defaultCacheTTL));
            }
        }));

        const fnOutlineFromDoc: { (doc: vscode.TextDocument): Promise<GinkgoOutline> } = doc => this.cachingOutliner.fromDocument(doc);

        this.testTreeDataExplorer = new GinkgoTestTreeDataExplorer(context, this.commands, fnOutlineFromDoc);
        new GinkgoTestFilesExplorer(context);

        const fnRunTest: { (args: { testNode: GinkgoNode, mode: string }): void } = (args) => {
            if (args && args.testNode && args.mode) {
                this.onRunTest(args.testNode, args.mode);
            }
        };
        new GinkgoRunTestCodeLensProvider(context, fnOutlineFromDoc, fnRunTest);

        this.statusBar = new StatusBar(context, 'ginkgotestexplorer.commandsStatusBar', 'ginkgotestexplorer.runningCommandStatusBar', 'ginkgotestexplorer.runAllProjectTests', 'ginkgotestexplorer.generateProjectCoverage');
        context.subscriptions.push(vscode.commands.registerCommand('ginkgotestexplorer.commandsStatusBar', () => {
            this.statusBar.onClickCommandsStatusBarItem();
        }));
        context.subscriptions.push(vscode.commands.registerCommand('ginkgotestexplorer.runningCommandStatusBar', () => {
            this.statusBar.onClickRunningCommandStatusBarItem();
        }));

        context.subscriptions.push(vscode.commands.registerCommand('ginkgotestexplorer.generateProjectCoverage', this.onGenerateProjectCoverage.bind(this)));
        context.subscriptions.push(vscode.commands.registerCommand('ginkgotestexplorer.generateSuiteCoverage', this.onGenerateSuiteCoverage.bind(this)));
        context.subscriptions.push(vscode.commands.registerCommand('ginkgotestexplorer.gotoSymbolInEditor', this.onGotoSymbolInEditor.bind(this)));
        context.subscriptions.push(vscode.commands.registerCommand("ginkgotestexplorer.runSuiteTest", this.onRunSuiteTest.bind(this)));
        context.subscriptions.push(vscode.commands.registerCommand("ginkgotestexplorer.runAllProjectTests", this.onRunAllProjectTests.bind(this)));
        context.subscriptions.push(vscode.commands.registerCommand("ginkgotestexplorer.showTestoutput", this.onShowTestOutput.bind(this)));
        context.subscriptions.push(vscode.commands.registerCommand("ginkgotestexplorer.installDependencies", this.onInstallDependencies.bind(this)));
    }

    private async onCheckGinkgoIsInstalledEmitter() {
        this.ginkgoTest.checkGinkgoIsInstalled(this.ginkgoPath);
    }

    private async onShowTestOutput(testNode: GinkgoNode) {
        if (testNode.result && testNode.result.output && testNode.result.output.length > 0) {
            outputChannel.clear();
            outputChannel.show();
            outputChannel.appendLine("");
            outputChannel.appendLine("# " + testNode.key);
            outputChannel.appendLine("output:");
            outputChannel.appendLine(testNode.result.output);
        }
    }

    private async onRunSuiteTest(rootNode: GinkgoNode | undefined) {
        // TODO: run simultaneos.
        await new Promise<boolean>(async resolve => {
            outputChannel.clear();
            if (!rootNode) {
                rootNode = this.testTreeDataExplorer.provider.rootNode;
            }
            if (rootNode) {
                this.testTreeDataExplorer.provider.prepareToRunTest(rootNode);
                await this.onRunTest(rootNode, 'run');
                resolve(true);
            } else {
                outputChannel.appendLine('Did not run test: no active text editor.');
                resolve(false);
            }
        });
    }

    private async onRunAllProjectTests() {
        // TODO: run simultaneos.
        await new Promise<boolean>(async (resolve, reject) => {
            this.statusBar.showRunningCommandBar("all project tests");
            outputChannel.clear();
            outputChannel.appendLine('Running all project tests...');
            try {
                await this.ginkgoTest.runGoTest();
            } catch (err) {
                outputChannel.appendLine(`Error while running all project tests: ${err}.`);
                reject(err);
            }
            this.statusBar.hideRunningCommandBar();
            resolve(true);
        });
    }

    private async onGenerateSuiteCoverage() {
        // TODO: run simultaneos.
        await new Promise<boolean>(async (resolve, reject) => {
            outputChannel.clear();

            const document = vscode.window.activeTextEditor?.document;
            const rootNode = this.testTreeDataExplorer.provider.rootNode;
            if (rootNode) {
                this.statusBar.showRunningCommandBar("suite coverage");

                await this.onRunSuiteTest(rootNode);

                outputChannel.appendLine('Generating suite coverage results...');
                try {
                    const output = await this.ginkgoTest.generateCoverage(document);
                    const viewPanel = vscode.window.createWebviewPanel('Coverage', `Coverage results: ${rootNode.text}`, { viewColumn: vscode.ViewColumn.Two, preserveFocus: true }, { enableScripts: true });
                    viewPanel.webview.html = output;
                    outputChannel.appendLine('Suite coverage has been generated.');
                } catch (err) {
                    outputChannel.appendLine(`Error while generating suite coverage: ${err}.`);
                    reject(err);
                }

                this.statusBar.hideRunningCommandBar();
                resolve(true);
            } else {
                outputChannel.appendLine('Did not generate suite coverage: no active text editor.');
                resolve(false);
            }
        });
    }

    private async onRunTest(testNode: GinkgoNode, mode: string) {
        this.testTreeDataExplorer.provider.prepareToRunTest(testNode);

        const editor = vscode.window.activeTextEditor;
        switch (mode) {
            case 'run':
                await this.ginkgoTest.runTest(testNode.key, editor?.document);
                break;
            case 'debug':
                await this.ginkgoTest.debugTest(testNode.key, editor?.document);
                break;
        }
    }

    private async onGenerateProjectCoverage() {
        // TODO: run simultaneos.
        await new Promise<boolean>(async (resolve, reject) => {
            this.statusBar.showRunningCommandBar("project coverage");
            outputChannel.show(true);
            outputChannel.clear();

            outputChannel.appendLine('Generating project coverage results...');
            try {
                await this.ginkgoTest.runGoTestOnOutputChannel();

                const output = await this.ginkgoTest.generateCoverage();
                const viewPanel = vscode.window.createWebviewPanel('Coverage', 'Project coverage result', { viewColumn: vscode.ViewColumn.Two, preserveFocus: true }, { enableScripts: true });
                viewPanel.webview.html = output;
                outputChannel.appendLine('Project coverage has been generated.');
            } catch (err) {
                outputChannel.appendLine(`Error while generating project coverage: ${err}.`);
                reject(err);
            }
            this.statusBar.hideRunningCommandBar();
            resolve(true);
        });
    }

    private async onGotoSymbolInEditor() {
        if (!vscode.window.activeTextEditor) {
            outputChannel.appendLine('Did not create the Go To Symbol menu: no active text editor');
            return;
        }
        try {
            await symbolPicker.fromTextEditor(vscode.window.activeTextEditor, doc => this.cachingOutliner.fromDocument(doc));
        } catch (err) {
            outputChannel.appendLine(`Could not create the Go To Symbol menu: ${err}`);
            const action = await vscode.window.showErrorMessage('Could not create the Go To Symbol menu', ...['Open Log']);
            if (action === 'Open Log') {
                outputChannel.show();
            }
        }
    }

    private async onInstallDependencies() {
        this.statusBar.showRunningCommandBar("ginkgo help");
        outputChannel.clear();
        outputChannel.show();
        await this.ginkgoTest.checkGinkgoIsInstalled(this.ginkgoPath);
        this.statusBar.hideRunningCommandBar();
    }

}
