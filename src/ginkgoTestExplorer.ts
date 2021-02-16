import * as vscode from 'vscode';
import { Outliner } from './outliner';
import { CachingOutliner } from './cachingOutliner';
import * as symbolPicker from './symbolPicker';
import * as treeDataProvider from './treeDataProvider';

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

    private cachingOutliner: CachingOutliner;

    constructor(context: vscode.ExtensionContext) {
        outputChannel = vscode.window.createOutputChannel(displayName);
        context.subscriptions.push(outputChannel);
        outputChannel.appendLine('Activating Ginkgo Outline');

        this.cachingOutliner = new CachingOutliner(new Outliner(getConfiguration().get('ginkgoPath', defaultGinkgoPath)), getConfiguration().get('cacheTTL', defaultCacheTTL));
        context.subscriptions.push({ dispose: () => { this.cachingOutliner.clear(); } });
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(evt => {
            if (affectsConfiguration(evt, 'ginkgoPath')) {
                this.cachingOutliner.setOutliner(new Outliner(getConfiguration().get('ginkgoPath', defaultGinkgoPath)));
            }
            if (affectsConfiguration(evt, 'cacheTTL')) {
                this.cachingOutliner.setCacheTTL(getConfiguration().get('cacheTTL', defaultCacheTTL));
            }
        }));

        context.subscriptions.push(vscode.commands.registerCommand("ginkgotestexplorer.runAllTest", this.onRunAllTests.bind(this)));
        context.subscriptions.push(vscode.commands.registerCommand('ginkgotestexplorer.GotoSymbolInEditor', this.onGotoSymbolInEditor.bind(this)));

        const ginkgoTreeDataProvider = new treeDataProvider.TreeDataProvider(context, doc => this.cachingOutliner.fromDocument(doc), 'ginkgotestexplorer.clickTreeItem',
            getConfiguration().get('updateOn', defaultUpdateOn),
            getConfiguration().get('updateOnTypeDelay', defaultUpdateOnTypeDelay),
            getConfiguration().get('doubleClickThreshold', defaultDoubleClickThreshold),
        );
        context.subscriptions.push(vscode.window.registerTreeDataProvider('ginkgotestexplorer', ginkgoTreeDataProvider));
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(evt => {
            if (affectsConfiguration(evt, 'updateOn')) {
                ginkgoTreeDataProvider.setUpdateOn(getConfiguration().get('updateOn', defaultUpdateOn));
            }
            if (affectsConfiguration(evt, 'updateOnTypeDelay')) {
                ginkgoTreeDataProvider.setUpdateOnTypeDelay(getConfiguration().get('updateOnTypeDelay', defaultUpdateOnTypeDelay));
            }
            if (affectsConfiguration(evt, 'doubleClickThreshold')) {
                ginkgoTreeDataProvider.setDoubleClickThreshold(getConfiguration().get('doubleClickThreshold', defaultDoubleClickThreshold));
            }
        }));
    }

    private onRunAllTests() {
        // this.goTestProvider.discoveredTests.
        //     filter(s => s.isTestSuite).
        //     forEach(t => this.runTestSuite(t));
        outputChannel.appendLine('Running all tests');
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