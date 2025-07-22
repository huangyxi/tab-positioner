'use strict';

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);


/**
 *
 * @param {*} logger
 * @param {'major' | 'minor' | 'patch'} since
 * @param {string} dirty
 * @returns
 */
export async function getGitInfo(
	logger,
	since = 'minor',
	dirty = '+dirty',
) {
	const versionPattern =
		since === 'major' ? 'v[0-9]*' :
		since === 'minor' ? 'v[0-9]*\.[0-9]*' :
		'v[0-9]*\.[0-9]*\.[0-9]*';
	let buildNumber = '.0';
	try {
		const { stdout: tagStdout } = await execAsync(
			`git describe --tags --match "${versionPattern}" --always`
		);
		const baseTag = tagStdout.trim();
		const { stdout: countStdout } = await execAsync(
			`git rev-list --count ${baseTag}..HEAD`
		);
		buildNumber = `.${countStdout.trim()}`;
	} catch (error) {
		logger.logWithOptions({
			prefix: '[GitInfo]',
			message: `Failed to get git build number, using default build number ${buildNumber}`,
			type: 'warn',
			color: 'yellow',
		})
	}
	let tag = 'v0.0.0';
	let version = '0.0.0.1';
	try {
		const { stdout } = await execAsync(
			`git describe --tags --match "v[0-9]*\.[0-9]*\.[0-9]*" --always --dirty=${dirty}`
		);
		tag = stdout.trim();
		version = tag.replace(/^v/, '');
		if (version.endsWith(dirty)) {
			version = version.slice(0, -dirty.length);
		}
		version = `${version}${buildNumber}`;
		tag = tag.endsWith(dirty) ? `v${version}${dirty}` : `v${version}`;
	} catch (error) {
		logger.logWithOptions({
			prefix: '[GitInfo]',
			message: `Failed to get git version, using default version ${version}, ${error.message}`,
			type: 'warn',
			color: 'yellow',
		})
	}
	let version_name = `${tag}-unknown`;
	try {
		const { stdout } = await execAsync('git rev-parse HEAD');
		const commit = stdout.trim().slice(0, 8);
		version_name = `${tag}-${commit}`;
	} catch (error) {
		logger.logWithOptions({
			prefix: '[GitInfo]',
			message: `Failed to get git commit, using default version name ${version_name}`,
			type: 'warn',
			color: 'yellow',
		})
	}
	const versionRegex = /^(\d+)(?:\.\d+){0,3}$/;
	if (!versionRegex.test(version)) {
		version = '0.0.0.1';
		logger.logWithOptions({
			prefix: '[GitInfo]',
			message: `Version '${version}' validation failed, using default version '0.0.1'`,
			type: 'warn',
			color: 'yellow',
		});
	}
	return { version, version_name };
}
