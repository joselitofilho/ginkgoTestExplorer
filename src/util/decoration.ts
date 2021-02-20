'use strict';

import * as vscode from 'vscode';
import * as path from "path";
import * as outliner from "../outliner";
import { Icons } from "../icons";

// iconForGinkgoNode returns the icon representation of the ginkgo node.
// See https://code.visualstudio.com/api/references/icons-in-labels#icon-listing
export function iconForGinkgoNode(context: vscode.ExtensionContext, node: outliner.GinkgoNode): vscode.ThemeIcon | { light: string | vscode.Uri; dark: string | vscode.Uri } {
    if (node.running) {
        return {
            dark: context.asAbsolutePath(path.join("resources", "dark", Icons.loading)),
            light: context.asAbsolutePath(path.join("resources", "light", Icons.loading))
        };
    }

    if (node.spec) {
        if (node.name === 'Measure') {
            return new vscode.ThemeIcon('dashboard');
        } else {
            if ((node.result && node.result.isSkipped) || (node.result === undefined && !node.focused)) {
                return {
                    dark: context.asAbsolutePath(path.join("resources", "dark", Icons.testClosed)),
                    light: context.asAbsolutePath(path.join("resources", "light", Icons.testClosed))
                };
            }

            let iconName = Icons.test;
            if (node.result) {
                iconName = (node.result.isPassed) ? Icons.testPassed : Icons.testFailed;
            }
            return {
                dark: context.asAbsolutePath(path.join("resources", "dark", iconName)),
                light: context.asAbsolutePath(path.join("resources", "light", iconName))
            };
        }
    }

    switch (node.name) {
        case 'BeforeEach':
        case 'AfterEach':
        case 'JustBeforeEach':
        case 'JustAfterEach':
        case 'BeforeSuite':
        case 'AfterSuite':
            return new vscode.ThemeIcon('wrench');
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
            return new vscode.ThemeIcon('symbol-package');
        case 'By':
            return new vscode.ThemeIcon('comment');
        default:
            return new vscode.ThemeIcon('play');
    }
}

export function iconForGinkgoNodeItem(node: outliner.GinkgoNode): vscode.ThemeIcon | undefined {
    if (node.spec) {
        if (node.name === 'Measure') {
            return new vscode.ThemeIcon('dashboard');
        } else {
            return new vscode.ThemeIcon('play');
        }
    }

    switch (node.name) {
        case 'BeforeEach':
        case 'AfterEach':
        case 'JustBeforeEach':
        case 'JustAfterEach':
        case 'BeforeSuite':
        case 'AfterSuite':
            return new vscode.ThemeIcon('wrench');
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
            return new vscode.ThemeIcon('symbol-package');
        case 'By':
            return new vscode.ThemeIcon('comment');
        default:
            return undefined;
    }
}

export function labelForGinkgoNode(node: outliner.GinkgoNode): string {
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
