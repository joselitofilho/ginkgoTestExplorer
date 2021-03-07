'use strict';

import * as vscode from 'vscode';
import * as outliner from './ginkgoOutliner';
import * as editorUtil from './util/editor';
import * as decorationUtil from './util/decoration';
import { Commands } from './commands';
import { affectsConfiguration, getConfiguration, outputChannel } from './ginkgoTestExplorer';
import { TestResult } from './testResult';
import { GinkgoNode, isRootNode, isRunnableTest, isWrenchNode } from './ginkgoNode';
import { constants, GO_MODE, UpdateOn } from './constants';
import { GinkgoTest } from './ginkgoTest';

export class GinkgoTestTreeDataProvider implements vscode.TreeDataProvider<GinkgoNode> {

    private readonly _onDidChangeTreeData: vscode.EventEmitter<GinkgoNode | undefined> = new vscode.EventEmitter<GinkgoNode | undefined>();
    readonly onDidChangeTreeData: vscode.Event<GinkgoNode | undefined> = this._onDidChangeTreeData.event;

    private updateListener?: vscode.Disposable;

    private editor?: vscode.TextEditor;
    private _roots: GinkgoNode[] = [];
    private discoveredTestsMap: Map<string, GinkgoNode>;
    private _discoveredTests: GinkgoNode[];
    private _rootNode?: GinkgoNode;

    private lastClickedNode?: GinkgoNode;
    private lastClickedTime?: number;

    private documentChangedTimer?: NodeJS.Timeout;

    constructor(private context: vscode.ExtensionContext, private commands: Commands, private readonly outlineFromDoc: { (doc: vscode.TextDocument): Promise<outliner.GinkgoOutline> }, private readonly clickTreeItemCommand: string, private updateOn: UpdateOn, private updateOnTypeDelay: number, private doubleClickThreshold: number) {
        // context.subscriptions.push(commands.discoveredTest(this.onDicoveredTest, this));
        context.subscriptions.push(commands.testRunStarted(this.onTestRunStarted, this));
        context.subscriptions.push(commands.testResults(this.onTestResult, this));
        context.subscriptions.push(vscode.commands.registerCommand(this.clickTreeItemCommand, async (node) => this.clickTreeItem(node)));
        context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(evt => this.onActiveEditorChanged(evt)));
        this.editor = vscode.window.activeTextEditor;
        this.setUpdateOn(this.updateOn);
        this.setUpdateOnTypeDelay(this.updateOnTypeDelay);
        this.discoveredTestsMap = new Map<string, GinkgoNode>();
        this._discoveredTests = [];
    }

    get discoveredTests(): GinkgoNode[] {
        return this._discoveredTests;
    }

    get roots(): GinkgoNode[] {
        return this._roots;
    }

    get rootNode(): GinkgoNode | undefined {
        return this._rootNode;
    }

    public setUpdateOn(updateOn: UpdateOn) {
        if (this.updateListener) {
            this.updateListener.dispose();
        }
        switch (updateOn) {
            case 'onType':
                this.updateListener = vscode.workspace.onDidChangeTextDocument(this.onDocumentChanged, this, this.context.subscriptions);
                break;
            case 'onSave':
                this.updateListener = vscode.workspace.onDidSaveTextDocument(this.onDocumentSaved, this, this.context.subscriptions);
                break;
        }
    }

    public setUpdateOnTypeDelay(updateOnTypeDelay: number) {
        this.updateOnTypeDelay = Math.max(updateOnTypeDelay, 0);
    }

    public setDoubleClickThreshold(doubleClickThreshold: number) {
        this.doubleClickThreshold = Math.max(doubleClickThreshold, 0);
    }

    public prepareToRunTest(node: GinkgoNode) {
        this.discoveredTests.
            filter(test => test.key === node.key).
            forEach(node => {this.commands.sendTestRunStarted(node);
                if (node.nodes.length > 0 && !isWrenchNode(node)) {
                    node.nodes.forEach(n => {
                        if (!isWrenchNode(n)) {
                            this.prepareToRunTest(n);
                        }
                    });
                }
            });
    }

    private onActiveEditorChanged(editor: vscode.TextEditor | undefined): void {
        if (editor && !isMainEditor(editor)) {
            // If the user switches to a non-main editor, e.g., settings, or
            // output, do not update the Outline view. This behavior is copied
            // from the language-level Outline view.
            this._rootNode = undefined;
            return;
        }
        this.editor = editor;
        this._roots = [];
        this._onDidChangeTreeData.fire(undefined);
    }

    private isDocumentForActiveEditor(doc: vscode.TextDocument): boolean {
        if (!this.editor) {
            return false;
        }
        return this.editor.document.uri.toString() === doc.uri.toString();
    }

    private onDocumentChanged(evt: vscode.TextDocumentChangeEvent): void {
        if (!this.isDocumentForActiveEditor(evt.document)) {
            return;
        }
        if (evt.contentChanges.length === 0) {
            return;
        }
        this._roots = [];
        if (this.documentChangedTimer) {
            clearTimeout(this.documentChangedTimer);
            this.documentChangedTimer = undefined;
        }
        this.documentChangedTimer = setTimeout(() => this._onDidChangeTreeData.fire(undefined), this.updateOnTypeDelay);
    }

    private onDocumentSaved(doc: vscode.TextDocument): void {
        if (!this.isDocumentForActiveEditor(doc)) {
            return;
        }
        this._roots = [];
        this._onDidChangeTreeData.fire(undefined);
    }

    async getChildren(element?: GinkgoNode | undefined): Promise<GinkgoNode[] | undefined> {
        if (!this.editor) {
            return undefined;
        }
        if (this.editor.document.languageId !== GO_MODE.language) {
            outputChannel.appendLine(`Did not populate outline view: document "${this.editor.document.uri}" language is not Go.`);
            return undefined;
        }
        if (this._roots.length === 0) {
            try {
                const outline = await this.outlineFromDoc(this.editor.document);
                this._roots = outline.nested;
                this.onDicoveredTest(outline.flat);
            } catch (err) {
                this.commands.sendCheckGinkgoIsInstalledEmitter();
                outputChannel.appendLine(`Could not populate the outline view: ${err}`);
                void vscode.window.showErrorMessage('Could not populate the outline view', ...['Open Log']).then(action => {
                    if (action === 'Open Log') {
                        outputChannel.show();
                    }
                });
                return undefined;
            }
        }

        if (!element) {
            return this._roots;
        }
        return element.nodes;
    }

    getTreeItem(testNode: GinkgoNode): vscode.TreeItem {
        const label = decorationUtil.labelForGinkgoNode(testNode);
        const collapsibleState: vscode.TreeItemCollapsibleState = testNode.nodes.length > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None;
        const treeItem = new vscode.TreeItem(label, collapsibleState);
        treeItem.iconPath = decorationUtil.iconForGinkgoNode(this.context, testNode);
        treeItem.tooltip = tooltipForGinkgoNode(testNode);
        treeItem.command = {
            command: this.clickTreeItemCommand,
            arguments: [testNode],
            title: ''
        };
        treeItem.contextValue = isRunnableTest(testNode) ? 'test' : '';
        return treeItem;
    }

    // clickTreeItem is a workaround for the TreeView only supporting only one "click" command.
    // It is inspired by https://github.com/fernandoescolar/vscode-solution-explorer/blob/master/src/commands/OpenFileCommand.ts,
    // which was discovered in https://github.com/microsoft/vscode/issues/39601#issuecomment-376415352.
    async clickTreeItem(element: GinkgoNode) {
        if (!this.editor) {
            return;
        }

        const now = Date.now();
        let recentlyClicked = false;
        if (this.lastClickedTime && this.lastClickedNode) {
            recentlyClicked = wasRecentlyClicked(this.doubleClickThreshold, this.lastClickedNode, this.lastClickedTime, element, now);
        }
        this.lastClickedTime = now;
        this.lastClickedNode = element;

        if (!recentlyClicked) {
            editorUtil.highlightNode(this.editor, element);
            return;

        }
        editorUtil.setSelectionToNodeStart(this.editor, element);
        editorUtil.highlightOff(this.editor);
        void vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
    }

    private onDicoveredTest(nodes: GinkgoNode[]) {
        this._rootNode = nodes.find(n => isRootNode(n));
        this._discoveredTests = nodes && nodes.length > 0 ? nodes : [];
        this.discoveredTestsMap = new Map();
        this._discoveredTests.forEach(node => {
            this.discoveredTestsMap.set(node.key, node);
        });
    }

    private onTestRunStarted(testNode: GinkgoNode) {
        testNode.running = true;
        this._onDidChangeTreeData.fire(testNode);
    }

    private onTestResult(testResults: TestResult[]) {
        const inResults: String[] = [];
        testResults.forEach(result => {
            const nodeName = result.testName;
            let testNode = this.discoveredTestsMap?.get(nodeName);
            if (testNode && testNode.running) {
                testNode.running = false;
                testNode.result = result;
                inResults.push(testNode.key);
                this._onDidChangeTreeData.fire(testNode);
            }
        });
        this._discoveredTests.
            filter(t => !inResults.includes(t.key) && t.running).
            forEach(testNode => {
                testNode.running = false;
                this._onDidChangeTreeData.fire(testNode);
            });
    }
}

function wasRecentlyClicked(threshold: number, lastClickedNode: GinkgoNode, lastClickedTime: number, currentNode: GinkgoNode, currentTime: number): boolean {
    const isSameNode = lastClickedNode.start === currentNode.start && lastClickedNode.end === currentNode.end;
    const wasRecentlyClicked = (currentTime - lastClickedTime) < threshold;
    return isSameNode && wasRecentlyClicked;
}

function tooltipForGinkgoNode(element: GinkgoNode): vscode.MarkdownString {
    let result: string = "-";
    if (element.result) {
        result = (element.result.isPassed) ? "passed" : (element.result.output) ? "\n\n" + element.result.output : "not passed";
    }
    return new vscode.MarkdownString(`**name:** ${element.name}  \n
**text:** ${element.text}  \n
**start:** ${element.start}  \n
**end:** ${element.end}  \n
**spec:** ${element.spec}  \n
**focused:** ${element.focused}  \n
**result:** ${result}`, false);
}

// isMainEditor returns true if the editor is one where a user is editing a Go file.
// > Will be undefined in case this isn't one of the main editors, e.g. an
// > embedded editor, or when the editor column is larger than three.
// > -- https://code.visualstudio.com/api/references/vscode-api#TextEditor
function isMainEditor(editor: vscode.TextEditor): boolean {
    return editor.viewColumn !== undefined;
}

export class GinkgoTestTreeDataExplorer {
    private treeDataProvider: GinkgoTestTreeDataProvider;

	constructor(context: vscode.ExtensionContext, commands: Commands, fnOutlineFromDoc: { (doc: vscode.TextDocument): Promise<outliner.GinkgoOutline> }) {
        this.treeDataProvider = new GinkgoTestTreeDataProvider(context, commands, fnOutlineFromDoc, 'ginkgotestexplorer.clickTreeItem',
            getConfiguration().get('updateOn', constants.defaultUpdateOn),
            getConfiguration().get('updateOnTypeDelay', constants.defaultUpdateOnTypeDelay),
            getConfiguration().get('doubleClickThreshold', constants.defaultDoubleClickThreshold),
        );
        context.subscriptions.push(vscode.window.createTreeView('ginkgotestexplorer', { treeDataProvider: this.treeDataProvider, showCollapseAll: true, canSelectMany: false }));
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(evt => {
            if (affectsConfiguration(evt, 'updateOn')) {
                this.treeDataProvider.setUpdateOn(getConfiguration().get('updateOn', constants.defaultUpdateOn));
            }
            if (affectsConfiguration(evt, 'updateOnTypeDelay')) {
                this.treeDataProvider.setUpdateOnTypeDelay(getConfiguration().get('updateOnTypeDelay', constants.defaultUpdateOnTypeDelay));
            }
            if (affectsConfiguration(evt, 'doubleClickThreshold')) {
                this.treeDataProvider.setDoubleClickThreshold(getConfiguration().get('doubleClickThreshold', constants.defaultDoubleClickThreshold));
            }
        }));
        context.subscriptions.push(vscode.commands.registerCommand("ginkgotestexplorer.runTest.tree", this.onRunTestTree.bind(this)));
	}

    get provider(): GinkgoTestTreeDataProvider {
        return this.treeDataProvider;
    }

    public async onRunTest(ginkgoTest: GinkgoTest, testNode: GinkgoNode, mode: string) {
        this.treeDataProvider.prepareToRunTest(testNode);

        const editor = vscode.window.activeTextEditor;
        switch (mode) {
            case 'run':
                await ginkgoTest.runTest(testNode.key, editor?.document);
                break;
            case 'debug':
                await ginkgoTest.debugTest(testNode.key, editor?.document);
                break;
        }
    }

    public async onRunTestTree(ginkgoTest: GinkgoTest, testNode: GinkgoNode) {
        await this.onRunTest(ginkgoTest, testNode, 'run');
    }
}