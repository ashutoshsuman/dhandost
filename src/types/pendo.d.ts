interface Pendo {
  track(event: string, properties?: Record<string, unknown>): void;
}

declare var pendo: Pendo | undefined;
