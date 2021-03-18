'use strict';

import * as fs from 'fs';

function stripBOM(s: string): string {
	if (s && s[0] === '\uFEFF') {
		s = s.substr(1);
	}
	return s;
}

export function parseEnvFile(envFilePath: string): { [key: string]: string } {
	const env: { [key: string]: string } = {};
	if (!envFilePath) {
		return env;
	}

	try {
		const buffer = stripBOM(fs.readFileSync(envFilePath, 'utf8'));
		buffer.split('\n').forEach((line) => {
			const r = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
			if (r !== null) {
				let value = r[2] || '';
				if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
					value = value.replace(/\\n/gm, '\n');
				}
				env[r[1]] = value.replace(/(^['"]|['"]$)/g, '');
			}
		});
		return env;
	} catch (e) {
		throw new Error(`Cannot load environment variables from file ${envFilePath}`);
	}
}