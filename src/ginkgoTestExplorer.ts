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

    constructor(ctx: vscode.ExtensionContext) {
        outputChannel = vscode.window.createOutputChannel(displayName);
        ctx.subscriptions.push(outputChannel);
        outputChannel.appendLine('Activating Ginkgo Outline');
        outputChannel.appendLine('ginkgoPath::' + getConfiguration().get('ginkgoPath', defaultGinkgoPath));

        const cachingOutliner = new CachingOutliner(new Outliner(getConfiguration().get('ginkgoPath', defaultGinkgoPath)), getConfiguration().get('cacheTTL', defaultCacheTTL));
        ctx.subscriptions.push({ dispose: () => { cachingOutliner.clear(); } });
        ctx.subscriptions.push(vscode.workspace.onDidChangeConfiguration(evt => {
            if (affectsConfiguration(evt, 'ginkgoPath')) {
                cachingOutliner.setOutliner(new Outliner(getConfiguration().get('ginkgoPath', defaultGinkgoPath)));
            }
            if (affectsConfiguration(evt, 'cacheTTL')) {
                cachingOutliner.setCacheTTL(getConfiguration().get('cacheTTL', defaultCacheTTL));
            }
        }));

        ctx.subscriptions.push(vscode.commands.registerCommand('ginkgotestexplorer.GotoSymbolInEditor', async () => {
            if (!vscode.window.activeTextEditor) {
                outputChannel.appendLine('Did not create the Go To Symbol menu: no active text editor');
                return;
            }
            try {
                await symbolPicker.fromTextEditor(vscode.window.activeTextEditor, doc => cachingOutliner.fromDocument(doc));
            } catch (err) {
                outputChannel.appendLine(`Could not create the Go To Symbol menu: ${err}`);
                const action = await vscode.window.showErrorMessage('Could not create the Go To Symbol menu', ...['Open Log']);
                if (action === 'Open Log') {
                    outputChannel.show();
                }
            }
        }));

        const ginkgoTreeDataProvider = new treeDataProvider.TreeDataProvider(ctx, doc => cachingOutliner.fromDocument(doc), 'ginkgotestexplorer.clickTreeItem',
            getConfiguration().get('updateOn', defaultUpdateOn),
            getConfiguration().get('updateOnTypeDelay', defaultUpdateOnTypeDelay),
            getConfiguration().get('doubleClickThreshold', defaultDoubleClickThreshold),
        );
        ctx.subscriptions.push(vscode.window.registerTreeDataProvider('ginkgotestexplorer.views.outline', ginkgoTreeDataProvider));
        ctx.subscriptions.push(vscode.workspace.onDidChangeConfiguration(evt => {
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

}