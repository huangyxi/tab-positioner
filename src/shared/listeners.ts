/* eslint-disable @typescript-eslint/no-explicit-any */
interface Callback {
	function: (...args: any[]) => void | Promise<void>;
	args: any[];
}

type CustomChromeEvent<H extends (...args: any) => void | Promise<void>> = Omit<api.events.Event<H>, 'addListener'> & {
	readonly addListener: H;
};

export class Listeners {
	private listeners: Map<CustomChromeEvent<any>, Callback[]> = new Map();

	public add<H extends (...args: any[]) => void | Promise<void>>(
		event: CustomChromeEvent<H>,
		...args: Parameters<H>
	): void;
	public add<H extends (...args: any[]) => void>(
		event: api.events.Event<H>,
		callback: (...args: Parameters<H>) => void | Promise<void>,
	): void;
	public add<H extends (...args: any[]) => void | Promise<void>>(
		event: CustomChromeEvent<H>,
		callback: H,
		...args: any[]
	): void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, []);
		}
		this.listeners.get(event)?.push({
			function: callback,
			args: args,
		});
	}

	public resolve(): void {
		for (const [event, callbacks] of this.listeners.entries()) {
			const noArgsCallbacks = callbacks.filter((cb) => cb.args.length === 0);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			event.addListener(async (..._args: any[]) => {
				for (const callback of noArgsCallbacks) {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
					const ret = callback.function(..._args);
					if (ret instanceof Promise) {
						await ret;
					}
				}
			});
			const argsCallbacks = callbacks.filter((cb) => cb.args.length > 0);
			for (const callback of argsCallbacks) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-call
				event.addListener(callback.function, ...callback.args);
			}
		}
	}
}
