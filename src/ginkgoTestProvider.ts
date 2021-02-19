'use strict';

import * as vscode from 'vscode';
import * as outliner from './outliner';
import * as editorUtil from './util/editor';
import * as decorationUtil from './util/decoration';
import { Commands } from './commands';
import { outputChannel } from './ginkgoTestExplorer';
import { TestResult } from './testResult';

type UpdateOn = 'onSave' | 'onType';
export class GinkgoTestProvider implements vscode.TreeDataProvider<outliner.GinkgoNode> {

    private readonly _onDidChangeTreeData: vscode.EventEmitter<outliner.GinkgoNode | undefined> = new vscode.EventEmitter<outliner.GinkgoNode | undefined>();
    readonly onDidChangeTreeData: vscode.Event<outliner.GinkgoNode | undefined> = this._onDidChangeTreeData.event;

    private updateListener?: vscode.Disposable;

    private editor?: vscode.TextEditor;
    private roots: outliner.GinkgoNode[] = [];
    private discoveredTestsMap: Map<string, outliner.GinkgoNode>;
    private _discoveredTests: outliner.GinkgoNode[];
    private _rootNode?: outliner.GinkgoNode;

    private lastClickedNode?: outliner.GinkgoNode;
    private lastClickedTime?: number;

    private documentChangedTimer?: NodeJS.Timeout;

    constructor(private readonly context: vscode.ExtensionContext, private commands: Commands, private readonly outlineFromDoc: { (doc: vscode.TextDocument): Promise<outliner.Outline> }, private readonly clickTreeItemCommand: string, private updateOn: UpdateOn, private updateOnTypeDelay: number, private doubleClickThreshold: number) {
        context.subscriptions.push(commands.discoveredTest(this.onDicoveredTest, this));
        context.subscriptions.push(commands.testRunStarted(this.onTestRunStarted, this));
        context.subscriptions.push(commands.testResults(this.onTestResult, this));
        context.subscriptions.push(vscode.commands.registerCommand(this.clickTreeItemCommand, async (node) => this.clickTreeItem(node)));
        context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(evt => this.onActiveEditorChanged(evt)));
        this.editor = vscode.window.activeTextEditor;
        this.setUpdateOn(this.updateOn);
        this.setUpdateOnTypeDelay(this.updateOnTypeDelay);
        this.discoveredTestsMap = new Map<string, outliner.GinkgoNode>();
        this._discoveredTests = new Array(0);
    }

    get discoveredTests(): outliner.GinkgoNode[] {
        return this._discoveredTests;
    }

    get rootNode(): outliner.GinkgoNode | undefined {
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

    public prepateToRunTest(node: outliner.GinkgoNode) {
        this.discoveredTests.
            filter(test => test.key === node.key).
            forEach(node => {
                this.commands.sendTestRunStarted(node);
                if (node.nodes.length > 0) {
                    node.nodes.forEach(c => this.prepateToRunTest(c));
                }
            });
    }

    private onActiveEditorChanged(editor: vscode.TextEditor | undefined): void {
        if (editor && !isMainEditor(editor)) {
            // If the user switches to a non-main editor, e.g., settings, or
            // output, do not update the Outline view. This behavior is copied
            // from the language-level Outline view.
            return;
        }
        this.editor = editor;
        this.roots = [];
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
        this.roots = [];
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
        this.roots = [];
        this._onDidChangeTreeData.fire(undefined);
    }

    async getChildren(element?: outliner.GinkgoNode | undefined): Promise<outliner.GinkgoNode[] | undefined> {
        if (!this.editor) {
            return undefined;
        }
        if (this.editor.document.languageId !== 'go') {
            outputChannel.appendLine(`Did not populate outline view: document "${this.editor.document.uri}" language is not Go.`);
            return undefined;
        }
        if (this.roots.length === 0) {
            try {
                const outline = await this.outlineFromDoc(this.editor.document);
                this.roots = outline.nested;
            } catch (err) {
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
            return this.roots;
        }
        return element.nodes;
    }

    getTreeItem(element: outliner.GinkgoNode): vscode.TreeItem {
        const label = decorationUtil.labelForGinkgoNode(element);
        const collapsibleState: vscode.TreeItemCollapsibleState = element.nodes.length > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None;
        const treeItem = new vscode.TreeItem(label, collapsibleState);
        treeItem.iconPath = decorationUtil.iconForGinkgoNode(this.context, element);
        treeItem.tooltip = tooltipForGinkgoNode(element);
        treeItem.command = {
            command: this.clickTreeItemCommand,
            arguments: [element],
            title: ''
        };
        treeItem.contextValue = (element.name !== 'By') ? 'test' : '';
        return treeItem;
    }

    // clickTreeItem is a workaround for the TreeView only supporting only one "click" command.
    // It is inspired by https://github.com/fernandoescolar/vscode-solution-explorer/blob/master/src/commands/OpenFileCommand.ts,
    // which was discovered in https://github.com/microsoft/vscode/issues/39601#issuecomment-376415352.
    async clickTreeItem(element: outliner.GinkgoNode) {
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

    private getNodeKey(node: outliner.GinkgoNode): string {
        if (node.name.endsWith("When")) {
            return this.getNodeKey(node.parent) + " when " + node.text;
        }
        if (node.parent) {
            return this.getNodeKey(node.parent) + " " + node.text;
        }
        return node.text;
    }

    private onDicoveredTest(nodes: outliner.GinkgoNode[]) {
        this._rootNode = nodes.find(n => n.parent === undefined && n.nodes.length > 0);
        this._discoveredTests = nodes && nodes.length > 0 ? nodes : [];
        this.discoveredTestsMap = new Map();
        this._discoveredTests.forEach(node => {
            node.key = this.getNodeKey(node).trim();
            this.discoveredTestsMap.set(node.key, node);
        });
    }

    private onTestRunStarted(testNode: outliner.GinkgoNode) {
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

function wasRecentlyClicked(threshold: number, lastClickedNode: outliner.GinkgoNode, lastClickedTime: number, currentNode: outliner.GinkgoNode, currentTime: number): boolean {
    const isSameNode = lastClickedNode.start === currentNode.start && lastClickedNode.end === currentNode.end;
    const wasRecentlyClicked = (currentTime - lastClickedTime) < threshold;
    return isSameNode && wasRecentlyClicked;
}

function tooltipForGinkgoNode(element: outliner.GinkgoNode): vscode.MarkdownString {
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