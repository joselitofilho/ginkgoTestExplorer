import * as vscode from 'vscode';
import * as symbolPicker from './symbolPicker';
import { GinkgoTestTreeDataProvider } from './ginkgoTestTreeDataProvider';
import { GinkgoOutline, GinkgoOutliner } from './ginkgoOutliner';
import { CachingOutliner } from './cachingOutliner';
import { Commands } from './commands';
import { constants, GO_MODE } from './constants';
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
    private ginkgoTest: GinkgoTest;
    private ginkgoTestTreeDataProvider: GinkgoTestTreeDataProvider;
    private ginkgoTestCodeLensProvider: GinkgoRunTestCodeLensProvider;
    private outliner: GinkgoOutliner;
    private statusBar: StatusBar;

    readonly commands: Commands;
    constructor(context: vscode.ExtensionContext) {
        this.commands = new Commands();
        outputChannel = vscode.window.createOutputChannel(constants.displayName);
        context.subscriptions.push(outputChannel);
        outputChannel.appendLine('Welcome to Ginkgo Explorer');

        const ginkgoPath = getConfiguration().get('ginkgoPath', constants.defaultGinkgoPath);

        this.checkGinkgoIsInstalled(ginkgoPath);

        let workspaceFolder: vscode.WorkspaceFolder | undefined;
        if (vscode.workspace.workspaceFolders) {
            workspaceFolder = vscode.workspace.workspaceFolders[0];
        }
        this.ginkgoTest = new GinkgoTest(ginkgoPath, this.commands, getConfiguration().get('testEnvVars', constants.defaultTestEnvVars), getConfiguration().get('testEnvFile', constants.defaultTestEnvFile), getConfiguration().get('executeCommandsOn', constants.defaultExecuteCommandsOn), workspaceFolder);
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(evt => {
            if (affectsConfiguration(evt, 'ginkgoPath')) {
                this.ginkgoTest.setGinkgoPath(getConfiguration().get('ginkgoPath', constants.defaultGinkgoPath));
            }
            if (affectsConfiguration(evt, 'testEnvVars')) {
                this.ginkgoTest.setTestEnvVars(getConfiguration().get('testEnvVars', constants.defaultTestEnvVars));
            }
            if (affectsConfiguration(evt, 'testEnvFile')) {
                this.ginkgoTest.setTestEnvFile(getConfiguration().get('testEnvFile', constants.defaultTestEnvFile));
            }
            if (affectsConfiguration(evt, 'executeCommandsOn')) {
                this.ginkgoTest.setExecuteCommandsOn(getConfiguration().get('executeCommandsOn', constants.defaultExecuteCommandsOn));
            }
        }));

        this.outliner = new GinkgoOutliner(ginkgoPath, this.commands);
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

        this.ginkgoTestTreeDataProvider = new GinkgoTestTreeDataProvider(context, this.commands, fnOutlineFromDoc, 'ginkgotestexplorer.clickTreeItem',
            getConfiguration().get('updateOn', constants.defaultUpdateOn),
            getConfiguration().get('updateOnTypeDelay', constants.defaultUpdateOnTypeDelay),
            getConfiguration().get('doubleClickThreshold', constants.defaultDoubleClickThreshold),
        );
        context.subscriptions.push(vscode.window.registerTreeDataProvider('ginkgotestexplorer', this.ginkgoTestTreeDataProvider));
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(evt => {
            if (affectsConfiguration(evt, 'updateOn')) {
                this.ginkgoTestTreeDataProvider.setUpdateOn(getConfiguration().get('updateOn', constants.defaultUpdateOn));
            }
            if (affectsConfiguration(evt, 'updateOnTypeDelay')) {
                this.ginkgoTestTreeDataProvider.setUpdateOnTypeDelay(getConfiguration().get('updateOnTypeDelay', constants.defaultUpdateOnTypeDelay));
            }
            if (affectsConfiguration(evt, 'doubleClickThreshold')) {
                this.ginkgoTestTreeDataProvider.setDoubleClickThreshold(getConfiguration().get('doubleClickThreshold', constants.defaultDoubleClickThreshold));
            }
        }));
        context.subscriptions.push(vscode.commands.registerCommand("ginkgotestexplorer.runTest.tree", this.onRunTestTree.bind(this)));

        this.ginkgoTestCodeLensProvider = new GinkgoRunTestCodeLensProvider(fnOutlineFromDoc);
        context.subscriptions.push(vscode.languages.registerCodeLensProvider(GO_MODE, this.ginkgoTestCodeLensProvider));
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(evt => {
            if (affectsConfiguration(evt, 'enableCodeLens')) {
                this.ginkgoTestCodeLensProvider.setEnabled(getConfiguration().get('enableCodeLens', constants.defaultEnableCodeLens));
            }
        }));
        context.subscriptions.push(vscode.commands.registerCommand("ginkgotestexplorer.runTest.codelens", (args) => {
            if (args && args.testNode && args.mode) {
                this.onRunTest(args.testNode, args.mode);
            }
        }));
        this.ginkgoTestCodeLensProvider.setEnabled(getConfiguration().get('enableCodeLens', constants.defaultEnableCodeLens));

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
    }

    private async checkGinkgoIsInstalled(ginkgoPath: string) {
        const isInstalled = await this.ginkgoTest.checkGinkgoIsInstalled(ginkgoPath);
        if (!isInstalled) {
            outputChannel.appendLine(`Ginkgo not found.`);
            const action = await vscode.window.showInformationMessage('The Ginkgo executable was not found.', ...['Install']);
            if (action === 'Install') {
                outputChannel.show();
                outputChannel.appendLine('Installing Ginkgo and Gomega.');
                outputChannel.appendLine('go get github.com/onsi/ginkgo/ginkgo');
                outputChannel.appendLine('go get github.com/onsi/gomega/...');
                outputChannel.appendLine('Please wait...');
                let installed = await this.ginkgoTest.callGinkgoInstall();
                if (installed) {
                    outputChannel.appendLine('Ginkgo has been installed successfully.');
                    installed = await this.ginkgoTest.callGomegaInstall();
                    if (installed) {
                        outputChannel.appendLine('Gomega has been installed successfully.');
                    } else {
                        outputChannel.appendLine('Error installing Ginkgo and Gomega.');
                    }
                } else {
                    outputChannel.appendLine('Error installing Ginkgo and Gomega.');
                }
            }
        }
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

    private async onRunTestTree(testNode: GinkgoNode) {
        await this.onRunTest(testNode, 'run');
    }

    private async onRunTest(testNode: GinkgoNode, mode: string) {
        this.ginkgoTestTreeDataProvider.prepareToRunTest(testNode);

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

    private async onRunSuiteTest(rootNode: GinkgoNode | undefined) {
        // TODO: run simultaneos.
        await new Promise<boolean>(async resolve => {
            outputChannel.clear();
            if (!rootNode) {
                rootNode = this.ginkgoTestTreeDataProvider.rootNode;
            }
            if (rootNode) {
                this.ginkgoTestTreeDataProvider.prepareToRunTest(rootNode);
                await this.onRunTestTree(rootNode);
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
            outputChannel.show(true);
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
            const rootNode = this.ginkgoTestTreeDataProvider.rootNode;
            if (rootNode) {
                this.statusBar.showRunningCommandBar("suite coverage");

                // TODO: Check if there was an error?
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

    private async onGenerateProjectCoverage() {
        // TODO: run simultaneos.
        await new Promise<boolean>(async (resolve, reject) => {
            this.statusBar.showRunningCommandBar("project coverage");
            outputChannel.show(true);
            outputChannel.clear();

            outputChannel.appendLine('Generating project coverage results...');
            try {
                await this.ginkgoTest.runGoTest();

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

}