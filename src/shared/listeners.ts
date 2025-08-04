export class Listeners {
	private listeners: Map<api.events.Event<any>, Function[]> = new Map();

	public add<T extends api.events.Event<any>>(
		event: T,
		callback: T extends api.events.Event<infer H> ? H : never,
	): void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, []);
		}
		this.listeners.get(event)?.push(callback);
	}

	public resolve(): void {
		for (const [event, callbacks] of this.listeners.entries()) {
			event.addListener(async (...args: any[]) => {
				for (const callback of callbacks) {
					const ret = callback(...args);
					if (ret instanceof Promise) {
						await ret;
					}
				}
			});
		}
	}
}
