import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
async function execCmd(cmd) {
	const { stdout } = await execAsync(cmd);
	return stdout.trim();
}

const TAG_MATCH = {
	major: 'v[0-9]*\\.0\\.0',
	minor: 'v[0-9]*\\.[0-9]*\\.0',
	patch: 'v[0-9]*\\.[0-9]*\\.[0-9]*',
}
const LOGGER_PREFIX = '[GitInfo]';

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
	try {
		const ret = await execCmd('git rev-parse --is-inside-work-tree');
		if (ret !== 'true') {
			throw new Error('Not a git repository');
		}
	} catch (error) {
		logger.logWithOptions({
			prefix: LOGGER_PREFIX,
			message: `Not in a git repository, or git is not installed, ` +
				`using default version '0.0.0.1'`,
			type: 'warn',
			color: 'yellow',
		});
		return {
			version: '0.0.0.1',
			version_name: 'v0.0.0.1-unknown',
		};
	}
	const versionPattern = TAG_MATCH[since] || TAG_MATCH.patch;
	let buildNumber = '.0';
	try {
		const stdout = await execCmd(
			`git tag --list "${versionPattern}" --sort=-creatordate`
		);
		const baseTags = stdout.split('\n').filter(Boolean);
		if (baseTags.length > 0) {
			const baseTag = baseTags[0];
			const count = await execCmd(
				`git rev-list --count ${baseTag}..HEAD`
			);
			buildNumber = `.${count}`;
		} else {
			logger.logWithOptions({
				prefix: LOGGER_PREFIX,
				message: `No tags found matching pattern '${versionPattern}', ` +
					`using default build number ${buildNumber}`,
				type: 'warn',
				color: 'yellow',
			});
		}
	} catch (error) {
		logger.logWithOptions({
			prefix: LOGGER_PREFIX,
			message: `Failed to get git build number, ` +
				`using default build number ${buildNumber}`,
			type: 'warn',
			color: 'yellow',
		})
	}
	let tag = 'v0.0.0';
	let version = '0.0.0.1';
	try {
		tag = await execCmd(
			`git describe --tags --match "v[0-9]*\\.[0-9]*\\.[0-9]*" --abbrev=0 --dirty=${dirty}`
		);
		version = tag.startsWith('v') ? tag.slice(1) : tag;
		if (version.endsWith(dirty)) {
			version = version.slice(0, -dirty.length);
		}
		version = `${version}${buildNumber}`;
		tag = tag.endsWith(dirty) ? `v${version}${dirty}` : `v${version}`;
	} catch (error) {
		logger.logWithOptions({
			prefix: LOGGER_PREFIX,
			message: `Failed to get git version, using default version ${version}, ${error.message}`,
			type: 'warn',
			color: 'yellow',
		})
	}
	let version_name = `${tag}-unknown`;
	try {
		const stdout = await execCmd(
			`git rev-parse HEAD`
		);
		const commit = stdout.slice(0, 8);
		version_name = `${tag}-${commit}`;
	} catch (error) {
		logger.logWithOptions({
			prefix: LOGGER_PREFIX,
			message: `Failed to get git commit, using default version name ${version_name}`,
			type: 'warn',
			color: 'yellow',
		})
	}
	const versionRegex = /^(\d+)(?:\.\d+){0,3}$/;
	if (!versionRegex.test(version)) {
		logger.logWithOptions({
			prefix: LOGGER_PREFIX,
			message: `Version '${version}' validation failed, using default version '0.0.0.1'`,
			type: 'warn',
			color: 'yellow',
		});
		version = '0.0.0.1';
	}
	return { version, version_name };
}
