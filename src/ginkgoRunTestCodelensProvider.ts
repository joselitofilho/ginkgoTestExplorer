'use strict';

import * as vscode from 'vscode';
import { CodeLens, Command, TextDocument } from 'vscode';
import { Commands } from './commands';
import { GinkgoNode, isRunnableTest } from './ginkgoNode';
import { rangeFromNode } from './util/editor';

export class GinkgoRunTestCodeLensProvider implements vscode.CodeLensProvider {
    protected enabled: boolean = true;
    private onDidChangeCodeLensesEmitter = new vscode.EventEmitter<void>();
    private testNodes: GinkgoNode[] = [];

    constructor(context: vscode.ExtensionContext, commands: Commands) {
        context.subscriptions.push(commands.discoveredTest(this.onDicoveredTest, this));
    }

    public get onDidChangeCodeLenses(): vscode.Event<void> {
        return this.onDidChangeCodeLensesEmitter.event;
    }

    public setEnabled(enabled: boolean = false): void {
        if (this.enabled !== enabled) {
            this.enabled = enabled;
            this.onDidChangeCodeLensesEmitter.fire();
        }
    }

    public provideCodeLenses(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.CodeLens[]> {
        if (!this.enabled) {
            return [];
        }
        if (!document.fileName.endsWith('_test.go')) {
            return [];
        }

        return Promise.all([
            this.getCodeLensForFunctions(document, this.testNodes)
        ]).then(([pkg, fns]) => {
            let res: any[] = [];
            if (pkg && Array.isArray(pkg)) {
                res = res.concat(pkg);
            }
            if (fns && Array.isArray(fns)) {
                res = res.concat(fns);
            }
            return res;
        });
    }

    private onDicoveredTest(nodes: GinkgoNode[]) {
        this.testNodes = nodes && nodes.length > 0 ? nodes : [];
    }

    private async getCodeLensForFunctions(
        document: TextDocument,
        testNodes: GinkgoNode[],
    ): Promise<CodeLens[]> {
        const codelens: CodeLens[] = [];

        testNodes.forEach((testNode) => {
            // TODO: Create a function for checking.
            if (testNode.parent === undefined && testNode.nodes.length > 0) {
                const runTestCmd: Command = {
                    title: 'run test',
                    command: 'ginkgotestexplorer.runAllTest',
                };
                const range = rangeFromNode(document, testNode);
                codelens.push(new CodeLens(range, runTestCmd));
            } else if (isRunnableTest(testNode)) {
                const runTestCmd: Command = {
                    title: 'run test',
                    command: 'ginkgotestexplorer.runTest.codelens',
                    arguments: [{ testNode }]
                };
                const range = rangeFromNode(document, testNode);
                codelens.push(new CodeLens(range, runTestCmd));
            }
        });

        return codelens;
    }

}