// A global context to track the currently running effect
let currentEffect: (() => void) | null = null;

export interface Signal<T> {
  (): T; // Getter
  (newValue: T): void; // Setter
  subscribe: (callback: (value: T) => void) => () => void;
}

/**
 * Creates a reactive signal that can be read and updated.
 * Signals automatically notify subscribers when their value changes.
 * @param initialValue The initial value of the signal.
 * @returns A signal accessor function.
 */
export function signal<T>(initialValue: T): Signal<T> {
  let value = initialValue;
  const subscribers = new Set<() => void>();

  const accessor = (...args: [T?]): void | T => {
    if (args.length === 0) {
      if (currentEffect) {
        subscribers.add(currentEffect);
      }
      return value;
    }

    const newValue = args[0] as T;
    if (Object.is(value, newValue)) {
      return;
    }

    value = newValue;
    for (const sub of [...subscribers]) {
      sub();
    }
  };

  accessor.subscribe = (callback: (value: T) => void) => {
    const sub = () => callback(value);
    subscribers.add(sub);
    return () => subscribers.delete(sub);
  };

  return accessor as Signal<T>;
}

/**
 * Creates a reactive computation that automatically re-runs
 * when any signals it reads are updated.
 * @param fn The function to run as an effect.
 */
export function effect(fn: () => void): void {
  const execute = () => {
    currentEffect = execute;
    try {
      fn();
    } finally {
      currentEffect = null;
    }
  };
  execute();
}

/**
 * Creates a read-only, derived signal that automatically updates
 * when its underlying dependencies change.
 * @param fn The function to compute the value.
 * @returns A getter function for the computed value.
 */
export function computed<T>(fn: () => T): () => T {
  const computedSignal = signal<T>(undefined as any);
  effect(() => {
    computedSignal(fn());
  });
  return () => computedSignal();
}