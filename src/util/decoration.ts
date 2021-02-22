'use strict';

import * as vscode from 'vscode';
import * as path from "path";
import { Icons } from "../icons";
import { GinkgoNode, isWrenchNode } from '../ginkgoNode';

// iconForGinkgoNode returns the icon representation of the ginkgo node.
// See https://code.visualstudio.com/api/references/icons-in-labels#icon-listing
export function iconForGinkgoNode(context: vscode.ExtensionContext, node: GinkgoNode): { light: string | vscode.Uri; dark: string | vscode.Uri } | undefined {
    if (node.running) {
        return {
            dark: context.asAbsolutePath(path.join("resources", "dark", Icons.loading)),
            light: context.asAbsolutePath(path.join("resources", "light", Icons.loading))
        };
    }

    if (node.spec) {
        if (node.pending && !node.name.startsWith("X")) {
            return {
                dark: context.asAbsolutePath(path.join("resources", "dark", Icons.testPending)),
                light: context.asAbsolutePath(path.join("resources", "light", Icons.testPending))
            };
        }

        if ((node.result && node.result.isSkipped) || (node.result === undefined && !node.focused) || node.name.startsWith("X")) {
            return {
                dark: context.asAbsolutePath(path.join("resources", "dark", Icons.testClosed)),
                light: context.asAbsolutePath(path.join("resources", "light", Icons.testClosed))
            };
        }

        let iconName = (node.name === 'Measure') ? Icons.measure : Icons.test;
        if (node.result) {
            if (node.name === 'Measure') {
                iconName = (node.result.isPassed) ? Icons.measurePassed : Icons.measureFailed;
            } else {
                iconName = (node.result.isPassed) ? Icons.testPassed : Icons.testFailed;
            }
        }
        return {
            dark: context.asAbsolutePath(path.join("resources", "dark", iconName)),
            light: context.asAbsolutePath(path.join("resources", "light", iconName))
        };
    }

    if (isWrenchNode(node)) {
        return {
            dark: context.asAbsolutePath(path.join("resources", "dark", Icons.wrench)),
            light: context.asAbsolutePath(path.join("resources", "light", Icons.wrench))
        };
    }

    switch (node.name) {
        case 'DescribeTable':
        case 'FDescribeTable':
        case 'PDescribeTable':
            return {
                dark: context.asAbsolutePath(path.join("resources", "dark", Icons.listTree)),
                light: context.asAbsolutePath(path.join("resources", "light", Icons.listTree))
            };
        case 'Context':
        case 'FContext':
        case 'PContext':
        case 'XContext':
        case 'Describe':
        case 'FDescribe':
        case 'PDescribe':
        case 'XDescribe':
        case 'When':
        case 'FWhen':
        case 'PWhen':
        case 'XWhen':
            return {
                dark: context.asAbsolutePath(path.join("resources", "dark", Icons.testSuite)),
                light: context.asAbsolutePath(path.join("resources", "light", Icons.testSuite))
            };
        case 'By':
            return {
                dark: context.asAbsolutePath(path.join("resources", "dark", Icons.testBy)),
                light: context.asAbsolutePath(path.join("resources", "light", Icons.testBy))
            };
        default:
            return undefined;
    }
}

export function iconForGinkgoNodeItem(node: GinkgoNode): vscode.ThemeIcon | undefined {
    if (node.spec) {
        if (node.name === 'Measure') {
            return new vscode.ThemeIcon('dashboard');
        } else {
            if (node.pending && !node.name.startsWith("X")) {
                return new vscode.ThemeIcon('testing-skipped-icon');
            }
            if (node.name.startsWith("X")) {
                return new vscode.ThemeIcon('issue-reopened');
            }
            return new vscode.ThemeIcon('play');
        }
    }

    if (isWrenchNode(node)) {
        return new vscode.ThemeIcon('wrench');
    }

    switch (node.name) {
        case 'DescribeTable':
        case 'FDescribeTable':
        case 'PDescribeTable':
            return new vscode.ThemeIcon('list-tree');
        case 'Context':
        case 'FContext':
        case 'PContext':
        case 'XContext':
        case 'Describe':
        case 'FDescribe':
        case 'PDescribe':
        case 'XDescribe':
        case 'When':
        case 'FWhen':
        case 'PWhen':
        case 'XWhen':
            return new vscode.ThemeIcon('test-view-icon');
        case 'By':
            return new vscode.ThemeIcon('comment');
        default:
            return undefined;
    }
}

export function labelForGinkgoNode(node: GinkgoNode): string {
    let prefix: string;
    switch (node.name) {
        case 'It':
        case 'FIt':
        case 'PIt':
        case 'XIt':
            prefix = 'It';
            break;
        case 'When':
        case 'FWhen':
        case 'PWhen':
        case 'XWhen':
            prefix = 'When';
            break;
        case 'Specify':
        case 'FSpecify':
        case 'PSpecify':
        case 'XSpecify':
            prefix = 'Specify';
            break;
        case 'Measure':
        case 'FMeasure':
        case 'PMeasure':
        case 'XMeasure':
            prefix = 'Measure';
            break;
        default:
            prefix = '';
    }
    return node.text ? `${prefix} ${node.text}` : node.name;
}
