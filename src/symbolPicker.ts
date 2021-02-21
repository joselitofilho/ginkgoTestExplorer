'use strict';

import * as vscode from 'vscode';
import * as outliner from './ginkgoOutliner';
import * as editorUtil from './util/editor';
import * as decorationUtil from './util/decoration';
import { outputChannel } from './ginkgoTestExplorer';
import { GinkgoNode } from './ginkgoNode';

class GinkgoNodeQuickPickItem implements vscode.QuickPickItem {
    label = '';
    description = '';
    detail = '';

    constructor(readonly node: GinkgoNode) {
        const icon = decorationUtil.iconForGinkgoNodeItem(node);
        if (icon) {
            this.label += `$(${icon.id}) `;
        }
        this.label += decorationUtil.labelForGinkgoNode(node);
    }
}

export async function fromTextEditor(editor: vscode.TextEditor, outlineFromDoc: { (doc: vscode.TextDocument): Promise<outliner.GinkgoOutline> }) {
    if (editor.document.languageId !== 'go') {
        outputChannel.appendLine(`Did not populate Go To Symbol menu: document "${editor.document.uri}" language is not Go.`);
        void vscode.window.showQuickPick([]);
        return;
    }

    const out = await outlineFromDoc(editor.document);
    const picker = vscode.window.createQuickPick<GinkgoNodeQuickPickItem>();
    const oldRange = (editor.visibleRanges.length > 0) ? editor.visibleRanges[0] : undefined;
    let didAcceptWithItem = false;
    picker.placeholder = 'Go to Ginkgo spec or container';
    picker.items = out.flat.map(n => new GinkgoNodeQuickPickItem(n));
    picker.onDidChangeActive(selection => {
        if (selection.length === 0) {
            return;
        }
        editorUtil.highlightNode(editor, selection[0].node);
    });
    picker.onDidAccept(() => {
        if (picker.selectedItems.length === 0) {
            return;
        }
        didAcceptWithItem = true;
        const node = picker.selectedItems[0].node;
        editorUtil.setSelectionToNodeStart(editor, node);
        picker.hide();
    });
    picker.onDidHide(() => {
        if (!didAcceptWithItem && oldRange) {
            editor.revealRange(oldRange, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
        }
        editorUtil.highlightOff(editor);
        picker.dispose();
    });
    picker.show();
}
