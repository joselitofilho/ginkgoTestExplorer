import * as vscode from 'vscode';
import * as symbolPicker from './symbolPicker';
import { GinkgoTestDiscover } from './ginkgoTestDiscover';
import { GinkgoTestProvider } from './ginkgoTestProvider';
import { GinkgoNode, Outliner } from './outliner';
import { CachingOutliner } from './cachingOutliner';
import { Commands } from './commands';

const extensionName = 'ginkgotestexplorer';
const displayName = 'Ginkgo Test Explorer';

// These are used when a property key is missing from settings, or its value is invalid.
const defaultGinkgoPath = 'ginkgo';
const defaultUpdateOn = 'onType';
const defaultUpdateOnTypeDelay = 1000;
const defaultDoubleClickThreshold = 400;
const defaultCacheTTL = 3600000;

export function getConfiguration(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(extensionName);
}

export function affectsConfiguration(evt: vscode.ConfigurationChangeEvent, name: string): boolean {
    return evt.affectsConfiguration(`${extensionName}.${name}`);
}

export let outputChannel: vscode.OutputChannel;

export class GinkgoTestExplorer {

    private ginkgoTestDiscover: GinkgoTestDiscover;
    private cachingOutliner: CachingOutliner;
    private outliner: Outliner;
    private ginkgoTreeDataProvider: GinkgoTestProvider;

    readonly commands: Commands;
    constructor(context: vscode.ExtensionContext) {
        this.commands = new Commands();
        outputChannel = vscode.window.createOutputChannel(displayName);
        context.subscriptions.push(outputChannel);
        outputChannel.appendLine('Welcome to Ginkgo Explorer');

        let cwd = "";
        if (vscode.workspace.workspaceFolders) {
            cwd = vscode.workspace.workspaceFolders[0].uri.fsPath;
        }
        this.ginkgoTestDiscover = new GinkgoTestDiscover(getConfiguration().get('ginkgoPath', defaultGinkgoPath), cwd, this.commands);

        this.outliner = new Outliner(getConfiguration().get('ginkgoPath', defaultGinkgoPath), this.commands);

        this.cachingOutliner = new CachingOutliner(this.outliner, getConfiguration().get('cacheTTL', defaultCacheTTL));
        context.subscriptions.push({ dispose: () => { this.cachingOutliner.clear(); } });
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(evt => {
            if (affectsConfiguration(evt, 'ginkgoPath')) {
                this.cachingOutliner.setOutliner(this.outliner);
            }
            if (affectsConfiguration(evt, 'cacheTTL')) {
                this.cachingOutliner.setCacheTTL(getConfiguration().get('cacheTTL', defaultCacheTTL));
            }
        }));

        this.ginkgoTreeDataProvider = new GinkgoTestProvider(context, this.commands, doc => this.cachingOutliner.fromDocument(doc), 'ginkgotestexplorer.clickTreeItem',
            getConfiguration().get('updateOn', defaultUpdateOn),
            getConfiguration().get('updateOnTypeDelay', defaultUpdateOnTypeDelay),
            getConfiguration().get('doubleClickThreshold', defaultDoubleClickThreshold),
        );
        context.subscriptions.push(vscode.window.registerTreeDataProvider('ginkgotestexplorer', this.ginkgoTreeDataProvider));
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(evt => {
            if (affectsConfiguration(evt, 'updateOn')) {
                this.ginkgoTreeDataProvider.setUpdateOn(getConfiguration().get('updateOn', defaultUpdateOn));
            }
            if (affectsConfiguration(evt, 'updateOnTypeDelay')) {
                this.ginkgoTreeDataProvider.setUpdateOnTypeDelay(getConfiguration().get('updateOnTypeDelay', defaultUpdateOnTypeDelay));
            }
            if (affectsConfiguration(evt, 'doubleClickThreshold')) {
                this.ginkgoTreeDataProvider.setDoubleClickThreshold(getConfiguration().get('doubleClickThreshold', defaultDoubleClickThreshold));
            }
        }));

        context.subscriptions.push(vscode.commands.registerCommand("ginkgotestexplorer.showTestoutput", this.onShowTestOutput.bind(this)));
        context.subscriptions.push(vscode.commands.registerCommand("ginkgotestexplorer.runTest", this.onRunTest.bind(this)));
        context.subscriptions.push(vscode.commands.registerCommand("ginkgotestexplorer.runAllTest", this.onRunAllTests.bind(this)));
        context.subscriptions.push(vscode.commands.registerCommand('ginkgotestexplorer.GotoSymbolInEditor', this.onGotoSymbolInEditor.bind(this)));
    }

    private async onShowTestOutput(testNode: GinkgoNode) {
        if (testNode.result && testNode.result.output && testNode.result.output.length > 0) {
            outputChannel.show();
            outputChannel.appendLine("");
            outputChannel.appendLine("# " + testNode.key);
            outputChannel.appendLine("output:");
            outputChannel.appendLine(testNode.result.output);
        }
    }

    private async onRunTest(testNode: GinkgoNode) {
        this.ginkgoTreeDataProvider.discoveredTests.
            filter(test => test.key === testNode.key && test.spec).
            forEach(node => this.commands.sendTestRunStarted(node));
        await this.ginkgoTestDiscover.runAllTest(testNode.key);
    }

    private async onRunAllTests() {
        this.ginkgoTreeDataProvider.discoveredTests.
            filter(test => test.spec).
            forEach(node => this.commands.sendTestRunStarted(node));
        await this.ginkgoTestDiscover.runAllTest();
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