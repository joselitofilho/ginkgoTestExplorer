'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as fileSystem from './util/fileSystem';

export class GinkgoTestFilesTreeDataProvider implements vscode.TreeDataProvider<fileSystem.FileEntry>, vscode.FileSystemProvider {
    private _onDidChangeFile: vscode.EventEmitter<vscode.FileChangeEvent[]>;

    constructor() {
        this._onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    }

    get onDidChangeFile(): vscode.Event<vscode.FileChangeEvent[]> {
        return this._onDidChangeFile.event;
    }

    watch(uri: vscode.Uri, options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
        const watcher = fs.watch(uri.fsPath, { recursive: options.recursive }, async (event: string, filename: string | Buffer) => {
            const filepath = path.join(uri.fsPath, fileSystem.normalizeNFC(filename.toString()));

            // TODO support excludes (using minimatch library?)

            this._onDidChangeFile.fire([{
                type: event === 'change' ? vscode.FileChangeType.Changed : await fileSystem.exists(filepath) ? vscode.FileChangeType.Created : vscode.FileChangeType.Deleted,
                uri: uri.with({ path: filepath })
            } as vscode.FileChangeEvent]);
        });

        return { dispose: () => watcher.close() };
    }

    stat(uri: vscode.Uri): vscode.FileStat | Thenable<vscode.FileStat> {
        return this._stat(uri.fsPath);
    }

    async _stat(path: string): Promise<vscode.FileStat> {
        return new fileSystem.FileStat(await fileSystem.stat(path));
    }

    readDirectory(uri: vscode.Uri): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
        return this._readDirectory(uri);
    }

    async _readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        const children = await fileSystem.readdir(uri.fsPath);

        const result: [string, vscode.FileType][] = [];
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const stat = await this._stat(path.join(uri.fsPath, child));
            if (stat.type === vscode.FileType.File) {
                if (child.endsWith('_test.go')) {
                    result.push([child, stat.type]);
                }
            } else {
                result.push([child, stat.type]);
            }
        }

        return Promise.resolve(result);
    }

    createDirectory(uri: vscode.Uri): void | Thenable<void> {
        return fileSystem.mkdir(uri.fsPath);
    }

    readFile(uri: vscode.Uri): Uint8Array | Thenable<Uint8Array> {
        return fileSystem.readfile(uri.fsPath);
    }

    writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): void | Thenable<void> {
        return this._writeFile(uri, content, options);
    }

    async _writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): Promise<void> {
        const exists = await fileSystem.exists(uri.fsPath);
        if (!exists) {
            if (!options.create) {
                throw vscode.FileSystemError.FileNotFound();
            }

            await fileSystem.mkdir(path.dirname(uri.fsPath));
        } else {
            if (!options.overwrite) {
                throw vscode.FileSystemError.FileExists();
            }
        }

        return fileSystem.writefile(uri.fsPath, content as Buffer);
    }

    delete(uri: vscode.Uri, options: { recursive: boolean; }): void | Thenable<void> {
        if (options.recursive) {
            return fileSystem.rmrf(uri.fsPath);
        }

        return fileSystem.unlink(uri.fsPath);
    }

    rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean; }): void | Thenable<void> {
        return this._rename(oldUri, newUri, options);
    }

    async _rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean; }): Promise<void> {
        const exists = await fileSystem.exists(newUri.fsPath);
        if (exists) {
            if (!options.overwrite) {
                throw vscode.FileSystemError.FileExists();
            } else {
                await fileSystem.rmrf(newUri.fsPath);
            }
        }

        const parentExists = await fileSystem.exists(path.dirname(newUri.fsPath));
        if (!parentExists) {
            await fileSystem.mkdir(path.dirname(newUri.fsPath));
        }

        return fileSystem.rename(oldUri.fsPath, newUri.fsPath);
    }

    // tree data provider

    async getChildren(element?: fileSystem.FileEntry): Promise<fileSystem.FileEntry[]> {
        if (element) {
            const children = await this.readDirectory(element.uri);
            return children.map(([name, type]) => ({ uri: vscode.Uri.file(path.join(element.uri.fsPath, name)), type }));
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.filter(folder => folder.uri.scheme === 'file')[0];
        if (workspaceFolder) {
            const children = await this.readDirectory(workspaceFolder.uri);
            children.sort((a, b) => {
                if (a[1] === b[1]) {
                    return a[0].localeCompare(b[0]);
                }
                return a[1] === vscode.FileType.Directory ? -1 : 1;
            });
            return children.map(([name, type]) => ({ uri: vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, name)), type }));
        }

        return [];
    }

    getTreeItem(element: fileSystem.FileEntry): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(element.uri, element.type === vscode.FileType.Directory ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None);
        if (element.type === vscode.FileType.File) {
            treeItem.command = { command: 'ginkgotestfilesexplorer.openFile', title: "open file", arguments: [element.uri], };
            treeItem.contextValue = 'file';
        }
        return treeItem;
    }
}

export class GinkgoTestFilesExplorer {
    constructor(context: vscode.ExtensionContext) {
        const treeDataProvider = new GinkgoTestFilesTreeDataProvider();
        context.subscriptions.push(vscode.window.createTreeView('ginkgotestfilesexplorer', { treeDataProvider, showCollapseAll: true, canSelectMany: false }));
        vscode.commands.registerCommand('ginkgotestfilesexplorer.openFile', (resource) => this.openResource(resource));
    }

    private openResource(resource: vscode.Uri): void {
        vscode.window.showTextDocument(resource);
    }
}
