'use strict';

import * as vscode from 'vscode';
import { GinkgoNode } from '../ginkgoNode';

const symbolHighlightDecorationType = vscode.window.createTextEditorDecorationType({
    light: {
        backgroundColor: { id: 'editor.selectionHighlightBackground' },
    },
    dark: {
        backgroundColor: { id: 'editor.selectionHighlightBackground' },
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: { id: 'contrastActiveBorder' }
    },
});

export function highlightNode(editor: vscode.TextEditor, node: GinkgoNode) {
    const range = rangeFromNode(editor.document, node);
    editor.setDecorations(symbolHighlightDecorationType, [range]);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

export function highlightOff(editor: vscode.TextEditor) {
    editor.setDecorations(symbolHighlightDecorationType, []);
}

export function setSelectionToNodeStart(editor: vscode.TextEditor, node: GinkgoNode) {
    const range = rangeFromNode(editor.document, node);
    const selection = new vscode.Selection(range.start, range.start);
    editor.selection = selection;
}

export function rangeFromNode(document: vscode.TextDocument, node: GinkgoNode): vscode.Range {
    const start = document.positionAt(node.start);
    const end = document.positionAt(node.end);
    return new vscode.Range(start, end);
}
