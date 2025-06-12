export interface Signal<T> {
  _value: T;
  _subscribers: ((v: T) => void)[];
  value: T;
}

export function signal<T>(initial: T, subscribers: Array<(v: T) => void>) {
  return {
    _value: initial,
    _subscribers: subscribers,
    get value() {
      return this._value;
    },
    set value(v: T) {
      this._value = v;
      for (const s of this._subscribers) {
        s(v);
      }
    },
  };
}
