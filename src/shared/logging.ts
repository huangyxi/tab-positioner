type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

export let LOG_LEVEL: LogLevel = 'info';

export function setGlobalLogLevel(level: LogLevel) {
	LOG_LEVEL = level;
}

const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error', 'none'];

export function compareLogLevels(levelA: LogLevel, levelB: LogLevel): number {
	return LOG_LEVELS.indexOf(levelA) - LOG_LEVELS.indexOf(levelB);
}

function shouldLog(level: LogLevel): boolean {
	return compareLogLevels(level, LOG_LEVEL) >= 0;
}

export function log(level: LogLevel, ...args: unknown[]) {
	if (!shouldLog(level)) {
		return;
	}
	const logFun = (console as unknown as Record<LogLevel, (...args: unknown[]) => void>)[level];
	logFun(...args);
}

export function logClosure(prefix: string) {
	return {
		log: (...args: unknown[]) => console.log(`${prefix}:`, ...args),
		debug: (...args: unknown[]) => log('debug', `${prefix}:`, ...args),
		info: (...args: unknown[]) => log('info', `${prefix}:`, ...args),
		warn: (...args: unknown[]) => log('warn', `${prefix}:`, ...args),
		error: (...args: unknown[]) => log('error', `${prefix}:`, ...args),
	};
}
