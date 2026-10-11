// Connectivity is confirmed by API responses, not by an assumed Wi-Fi connection.
let offline = false;
const listeners = new Set<() => void>();
export const connectivity = {
  get: () => offline,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  set: (next: boolean) => {
    if (offline !== next) {
      offline = next;
      listeners.forEach((l) => l());
    }
  },
};
