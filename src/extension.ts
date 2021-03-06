'use strict';

import * as vscode from 'vscode';
import { GinkgoTestExplorer } from './ginkgoTestExplorer';

export function activate(context: vscode.ExtensionContext) {
	new GinkgoTestExplorer(context);
}
