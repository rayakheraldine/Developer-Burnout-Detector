import { useEffect, useState } from "react";

// Returns `value`, but only after it has stopped changing for `delay` ms
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer); // value changed again -> cancel the pending update
  }, [value, delay]);

  return debounced;
}