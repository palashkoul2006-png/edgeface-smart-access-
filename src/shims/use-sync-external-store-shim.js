// ESM shim for use-sync-external-store/shim/with-selector
// recharts imports this as a named ESM export but the package only ships CJS.
// We re-export through React's own useSyncExternalStore + a mini selector impl.
import { useSyncExternalStore, useRef, useEffect, useMemo, useDebugValue } from "react";

function is(x, y) {
  return (x === y && (x !== 0 || 1 / x === 1 / y)) || (x !== x && y !== y);
}

export function useSyncExternalStoreWithSelector(
  subscribe,
  getSnapshot,
  getServerSnapshot,
  selector,
  isEqual
) {
  const instRef = useRef(null);
  let inst;
  if (instRef.current === null) {
    inst = { hasValue: false, value: null };
    instRef.current = inst;
  } else {
    inst = instRef.current;
  }

  const [getSelection, getServerSelection] = useMemo(() => {
    let hasMemo = false;
    let memoizedSnapshot;
    let memoizedSelection;
    const memoizedSelector = (nextSnapshot) => {
      if (!hasMemo) {
        hasMemo = true;
        memoizedSnapshot = nextSnapshot;
        const nextSelection = selector(nextSnapshot);
        if (isEqual !== undefined) {
          if (inst.hasValue) {
            const currentSelection = inst.value;
            if (isEqual(currentSelection, nextSelection)) {
              memoizedSelection = currentSelection;
              return currentSelection;
            }
          }
        }
        memoizedSelection = nextSelection;
        return nextSelection;
      }
      const prevSnapshot = memoizedSnapshot;
      const prevSelection = memoizedSelection;
      if (is(prevSnapshot, nextSnapshot)) {
        return prevSelection;
      }
      const nextSelection = selector(nextSnapshot);
      if (isEqual !== undefined && isEqual(prevSelection, nextSelection)) {
        return prevSelection;
      }
      memoizedSnapshot = nextSnapshot;
      memoizedSelection = nextSelection;
      return nextSelection;
    };
    const maybeGetServerSnapshot =
      getServerSnapshot === undefined ? null : getServerSnapshot;
    return [
      () => memoizedSelector(getSnapshot()),
      maybeGetServerSnapshot !== null
        ? () => memoizedSelector(maybeGetServerSnapshot())
        : maybeGetServerSnapshot,
    ];
  }, [getSnapshot, getServerSnapshot, selector, isEqual]);

  const value = useSyncExternalStore(subscribe, getSelection, getServerSelection);

  useEffect(() => {
    inst.hasValue = true;
    inst.value = value;
  }, [inst, value]);

  useDebugValue(value);
  return value;
}
