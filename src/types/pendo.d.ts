interface Window {
  pendo?: {
    trackAgent: (eventType: string, metadata: object) => void;
  };
}

declare var pendo: {
  trackAgent(eventType: string, metadata: object): void;
  [key: string]: any;
};
