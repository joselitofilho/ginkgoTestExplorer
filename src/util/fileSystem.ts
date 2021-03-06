'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as rimraf from 'rimraf';

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
        rimraf(path, error => handleResult(resolve, reject, error, void 0));
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
