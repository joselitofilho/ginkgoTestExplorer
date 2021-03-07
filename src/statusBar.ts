'use strict';

import * as vscode from 'vscode';
import { outputChannel } from './ginkgoTestExplorer';

const runAllProjectTests = "$(testing-run-all-icon) Run all project tests";
const runProjectCoverage = "$(shield) Run project coverage";

export class StatusBar {

    private commandsStatusBarItem: vscode.StatusBarItem;
    private runningCommandStatusBarItem: vscode.StatusBarItem;

    constructor(private readonly context: vscode.ExtensionContext, private readonly runAllProjectTestCommand: string, private readonly generateProjectCoverageCommand: string) {
        this.context.subscriptions.push(vscode.commands.registerCommand('ginkgotestexplorer.commandsStatusBar', () => {
            this.onClickCommandsStatusBarItem();
        }));
        this.context.subscriptions.push(vscode.commands.registerCommand('ginkgotestexplorer.runningCommandStatusBar', () => {
            this.onClickRunningCommandStatusBarItem();
        }));

        this.commandsStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 101);
        this.commandsStatusBarItem.command = 'ginkgotestexplorer.commandsStatusBar';
        this.context.subscriptions.push(this.commandsStatusBarItem);
        this.commandsStatusBarItem.text = runAllProjectTests;
        this.commandsStatusBarItem.tooltip = "Select and start the run project tests or coverage";
        this.commandsStatusBarItem.show();

        this.runningCommandStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.runningCommandStatusBarItem.command = 'ginkgotestexplorer.runningCommandStatusBar';
        this.context.subscriptions.push(this.runningCommandStatusBarItem);
    }

    public onClickCommandsStatusBarItem() {
        const options = [
            { label: runAllProjectTests },
            { label: runProjectCoverage }
        ];
        vscode.window.showQuickPick(options).then((item) => {
            if (item) {
                this.commandsStatusBarItem.text = item.label;
                switch (item.label) {
                    case runAllProjectTests:
                        vscode.commands.executeCommand(this.runAllProjectTestCommand);
                        break;
                    case runProjectCoverage:
                        vscode.commands.executeCommand(this.generateProjectCoverageCommand);
                        break;
                }
            }
        });
    }

    public onClickRunningCommandStatusBarItem() {
        // TODO vscode.window.activeTerminal?.show(true);
        outputChannel.show(true);
    }

    public showRunningCommandBar(label: string) {
        this.runningCommandStatusBarItem.text = `$(sync~spin) Running ${label}`;
        this.runningCommandStatusBarItem.tooltip = "Click to see the command output";
        this.runningCommandStatusBarItem.show();
    }

    public hideRunningCommandBar() {
        this.runningCommandStatusBarItem.hide();
    }
    
}