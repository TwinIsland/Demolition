/**
 * The four grid neighbours. Kept free of imports: the mod SDK re-exports helpers built on it, and the SDK is
 * evaluated while the catalog is still loading, before registries such as `maps.ts` can be built.
 */
export const DIRECTIONS = [
  { x: 1, z: 0 },
  { x: -1, z: 0 },
  { x: 0, z: 1 },
  { x: 0, z: -1 },
];
