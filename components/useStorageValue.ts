import { useEffect, useState } from 'react';

import type { WxtStorageItem } from '#imports';

/** A storage item's value, kept current; undefined until the first read resolves. */
export function useStorageValue<T>(item: WxtStorageItem<T, Record<string, unknown>>): T | undefined {
  const [value, setValue] = useState<T>();

  useEffect(() => {
    let active = true;
    void item.getValue().then((initial) => {
      if (active) setValue(initial);
    });
    const unwatch = item.watch((next) => setValue(next));
    return () => {
      active = false;
      unwatch();
    };
  }, [item]);

  return value;
}
