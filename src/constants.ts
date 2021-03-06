'use strict';

import * as vscode from 'vscode';

export const GO_MODE: vscode.DocumentFilter = { language: 'go', scheme: 'file' };

export type UpdateOn = 'onSave' | 'onType';
export type ExecuteCommandsOn = 'onOutputChannel' | 'onTerminal';

export const constants = {
    extensionName: 'ginkgotestexplorer',
    displayName: 'Ginkgo Test Explorer',

    // These are used when a property key is missing from settings, or its value is invalid.
    defaultGinkgoPath: 'ginkgo',
    defaultUpdateOn: 'onType' as UpdateOn,
    defaultUpdateOnTypeDelay: 1000,
    defaultDoubleClickThreshold: 400,
    defaultCacheTTL: 3600000,
    defaultEnableCodeLens: true,
    defaultTestEnvVars: {},
    defaultTestEnvFile: "",
    defaultExecuteCommandsOn: 'onTerminal' as ExecuteCommandsOn
};