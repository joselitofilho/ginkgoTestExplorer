'use strict';

import * as vscode from 'vscode';
import * as cp from 'child_process';
import { Commands } from './commands';
import { GinkgoNode } from './ginkgoNode';
import { detectGinkgoMajorVersion } from './util/ginkgoVersion';

export interface GinkgoOutline {
    nested: GinkgoNode[];
    flat: GinkgoNode[];
}

export function preOrder(node: GinkgoNode, f: Function): void {
    f(node);
    if (node.nodes) {
        for (let c of node.nodes) {
            preOrder(c, f);
        }
    }
}

export class GinkgoOutliner {
    private ginkgoMajorVersion: number = 2;

    constructor(private ginkgoPath: string, private commands: Commands) {
        this.detectGinkgoMajorVersion();
    };

    private async detectGinkgoMajorVersion() {
        try {
            this.ginkgoMajorVersion = await detectGinkgoMajorVersion(this.ginkgoPath);
        } catch (err) {}
    }

    public setGinkgoPath(ginkgoPath: string) {
        this.ginkgoPath = ginkgoPath;
        this.detectGinkgoMajorVersion();
    }

    // fromDocument returns the ginkgo outline for the TextDocument. It calls ginkgo
    // as an external process.
    public async fromDocument(doc: vscode.TextDocument): Promise<GinkgoOutline> {
        const output: string = await callGinkgoOutline(this.ginkgoPath, doc);
        const outline: GinkgoOutline = fromJSON(output, this.ginkgoMajorVersion);
        this.commands.sendDiscoveredTests(outline.flat);
        return outline;
    }

}

export const ginkgoImportsNotFoundError = "error creating outline: file does not import \"github.com/onsi/ginkgo\" or \"github.com/onsi/ginkgo/extensions/table\"";

export function isGinkgoImportsNotFoundError(err: Error): boolean {
    if (!err.message) {
        return false;
    }
    return err.message.indexOf(ginkgoImportsNotFoundError) > 0;
}

export async function callGinkgoOutline(ginkgoPath: string, doc: vscode.TextDocument): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
        const p = cp.execFile(ginkgoPath, ['outline', '--format=json', '-'], {}, (err, stdout, stderr) => {
            if (err) {
                let msg = `error running "${err.cmd}"`;
                if (err.code) {
                    msg += ` (error code ${err.code})`;
                }
                if (stderr) {
                    msg += `: ${stderr}`;
                }
                return reject(new Error(msg));
            }
            const outline = stdout.toString();
            return resolve(outline);
        });
        if (p.pid) {
            if (!p.stdin) {
                return reject(new Error(`unable to write to stdin of ginkgo process: pipe does not exist`));
            }
            p.stdin.end(doc.getText());
        }
    });
}

function getNodeKey(node: GinkgoNode, ginkgoMajorVersion: number): string {
    if (ginkgoMajorVersion < 2 && node.name.endsWith("When")) {
        return getNodeKey(node.parent, ginkgoMajorVersion) + " when " + node.text;
    }
    if (node.parent) {
        return getNodeKey(node.parent, ginkgoMajorVersion) + " " + node.text;
    }
    return node.text;
}

export function fromJSON(input: string, ginkgoMajorVersion: number): GinkgoOutline {
    const nested: GinkgoNode[] = JSON.parse(input);

    nested.forEach(node => {
        node.key = getNodeKey(node, ginkgoMajorVersion).trim();
    });

    const flat: GinkgoNode[] = [];
    for (let n of nested) {
        preOrder(n, function (n: GinkgoNode) {
            // Construct the "flat" list of nodes
            flat.push(n);

            // Annotate every child with its parent
            for (let c of n.nodes) {
                c.parent = n;
            }
        });
    }
    
    flat.forEach(node => {
        node.key = getNodeKey(node, ginkgoMajorVersion).trim();
    });

    const hasFocused = flat.find(o => o.focused);
    if (hasFocused === undefined) {
        flat.forEach(o => {
            if (!o.name.startsWith("X") || !o.pending) {
                o.focused = true;
            }
        });
    }

    return { nested, flat };
}