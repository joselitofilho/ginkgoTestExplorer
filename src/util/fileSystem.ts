'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export function handleResult<T>(resolve: (result: T) => void, reject: (error: Error) => void, error: Error | null | undefined, result: T): void {
    if (error) {
        reject(massageError(error));
    } else {
        resolve(result);
    }
}

export function massageError(error: Error & { code?: string }): Error {
    if (error.code === 'ENOENT') {
        return vscode.FileSystemError.FileNotFound();
    }

    if (error.code === 'EISDIR') {
        return vscode.FileSystemError.FileIsADirectory();
    }

    if (error.code === 'EEXIST') {
        return vscode.FileSystemError.FileExists();
    }

    if (error.code === 'EPERM' || error.code === 'EACCESS') {
        return vscode.FileSystemError.NoPermissions();
    }

    return error;
}

export function checkCancellation(token: vscode.CancellationToken): void {
    if (token.isCancellationRequested) {
        throw new Error('Operation cancelled');
    }
}

export function normalizeNFC(items: string): string;
export function normalizeNFC(items: string[]): string[];
export function normalizeNFC(items: string | string[]): string | string[] {
    if (process.platform !== 'darwin') {
        return items;
    }

    if (Array.isArray(items)) {
        return items.map(item => item.normalize('NFC'));
    }

    return items.normalize('NFC');
}

export function readdir(path: string): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
        fs.readdir(path, (error, children) => handleResult(resolve, reject, error, normalizeNFC(children)));
    });
}

export function stat(path: string): Promise<fs.Stats> {
    return new Promise<fs.Stats>((resolve, reject) => {
        fs.stat(path, (error, stat) => handleResult(resolve, reject, error, stat));
    });
}

export function readfile(path: string): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        fs.readFile(path, (error, buffer) => handleResult(resolve, reject, error, buffer));
    });
}

export function writefile(path: string, content: Buffer): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        fs.writeFile(path, content, error => handleResult(resolve, reject, error, void 0));
    });
}

export function exists(path: string): Promise<boolean> {
    return new Promise<boolean>(() => {
        return fs.existsSync(path);
    });
}

export function rmrf(path: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        // TODO implement
    });
}

export function mkdir(path: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        fs.mkdir(path, { recursive: true }, error => handleResult(resolve, reject, error, void 0));
    });
}

export function rename(oldPath: string, newPath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        fs.rename(oldPath, newPath, error => handleResult(resolve, reject, error, void 0));
    });
}

export function unlink(path: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        fs.unlink(path, error => handleResult(resolve, reject, error, void 0));
    });
}

export class FileStat implements vscode.FileStat {

    constructor(private fsStat: fs.Stats) { }

    get type(): vscode.FileType {
        return this.fsStat.isFile() ? vscode.FileType.File : this.fsStat.isDirectory() ? vscode.FileType.Directory : this.fsStat.isSymbolicLink() ? vscode.FileType.SymbolicLink : vscode.FileType.Unknown;
    }

    get isFile(): boolean | undefined {
        return this.fsStat.isFile();
    }

    get isDirectory(): boolean | undefined {
        return this.fsStat.isDirectory();
    }

    get isSymbolicLink(): boolean | undefined {
        return this.fsStat.isSymbolicLink();
    }

    get size(): number {
        return this.fsStat.size;
    }

    get ctime(): number {
        return this.fsStat.ctime.getTime();
    }

    get mtime(): number {
        return this.fsStat.mtime.getTime();
    }
}

export interface FileEntry {
    uri: vscode.Uri;
    type: vscode.FileType;
}

export function resolvePath(inputPath: string, workspaceFolder?: string): string {
	if (!inputPath || !inputPath.trim()) {
		return inputPath;
	}

	if (!workspaceFolder && vscode.workspace.workspaceFolders) {
		workspaceFolder = getWorkspaceFolderPath(
			vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri
		);
	}

	if (workspaceFolder) {
		inputPath = inputPath.replace(/\${workspaceFolder}|\${workspaceRoot}/g, workspaceFolder);
	}
	return resolveHomeDir(inputPath);
}

export function getWorkspaceFolderPath(fileUri?: vscode.Uri): string | undefined {
	if (fileUri) {
		const workspace = vscode.workspace.getWorkspaceFolder(fileUri);
		if (workspace) {
			return fixDriveCasingInWindows(workspace.uri.fsPath);
		}
	}

	// fall back to the first workspace
	const folders = vscode.workspace.workspaceFolders;
	if (folders && folders.length) {
		return fixDriveCasingInWindows(folders[0].uri.fsPath);
	}
	return undefined;
}

// Workaround for issue in https://github.com/Microsoft/vscode/issues/9448#issuecomment-244804026
export function fixDriveCasingInWindows(pathToFix: string): string {
	return process.platform === 'win32' && pathToFix
		? pathToFix.substr(0, 1).toUpperCase() + pathToFix.substr(1)
		: pathToFix;
}

export function resolveHomeDir(inputPath: string): string {
	if (!inputPath || !inputPath.trim()) {
		return inputPath;
	}
	return inputPath.startsWith('~') ? path.join(os.homedir(), inputPath.substr(1)) : inputPath;
}

// Walks up given folder path to return the closest ancestor that has `src` as a child
export function getInferredGopath(folderPath: string): string | undefined {
	if (!folderPath) {
		return;
	}

	const dirs = folderPath.toLowerCase().split(path.sep);

	// find src directory closest to given folder path
	const srcIdx = dirs.lastIndexOf('src');
	if (srcIdx > 0) {
		return folderPath.substr(0, dirs.slice(0, srcIdx).join(path.sep).length);
	}
}
