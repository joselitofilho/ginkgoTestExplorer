'use strict';

import * as vscode from 'vscode';
import { GinkgoOutline } from './ginkgoOutliner';
import { CodeLens, Command, TextDocument } from 'vscode';
import { isRunnableTest } from './ginkgoNode';
import { rangeFromNode } from './util/editor';

export class GinkgoRunTestCodeLensProvider implements vscode.CodeLensProvider {
    protected enabled: boolean = true;
    private onDidChangeCodeLensesEmitter = new vscode.EventEmitter<void>();

    constructor(private readonly outlineFromDoc: { (doc: vscode.TextDocument): Promise<GinkgoOutline> }) { }

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
        document: vscode.TextDocument
    ): vscode.ProviderResult<vscode.CodeLens[]> {
        if (!this.enabled) {
            return [];
        }
        if (!document.fileName.endsWith('_test.go')) {
            return [];
        }

        return Promise.all([
            this.getCodeLensForFunctions(document)
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

    private async getCodeLensForFunctions(
        document: TextDocument
    ): Promise<CodeLens[]> {
        const codelens: CodeLens[] = [];

        const outline = await this.outlineFromDoc(document);
        const testNodes = outline.flat;

        testNodes.forEach((testNode) => {
            if (isRunnableTest(testNode)) {
                const range = rangeFromNode(document, testNode);

                const runTestCmd: Command = {
                    title: 'run test',
                    command: 'ginkgotestexplorer.runTest.codelens',
                    arguments: [{ testNode, 'mode': 'run' }]
                };
                codelens.push(new CodeLens(range, runTestCmd));

                const debugTestCmd: Command = {
                    title: 'debug test',
                    command: 'ginkgotestexplorer.runTest.codelens',
                    arguments: [{ testNode, 'mode': 'debug' }]
                };
                codelens.push(new CodeLens(range, debugTestCmd));
            }
        });

        return codelens;
    }

}