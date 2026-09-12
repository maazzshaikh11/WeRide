/**
 * The hazard package typechecks its Map overlay component tests without
 * installing the full React Native application package. Runtime builds use
 * the concrete dependencies declared by app/package.json.
 */
declare module '@rnmapbox/maps' {
  const MapboxGL: any;
  export default MapboxGL;
}

declare module 'zustand' {
  type BoundStore<T> = {
    <U>(selector: (state: T) => U): U;
    getState: () => T;
  };
  export function create<T>(initializer: (set: (partial: T | Partial<T> | ((state: T) => T | Partial<T>)) => void) => T): BoundStore<T>;
}
