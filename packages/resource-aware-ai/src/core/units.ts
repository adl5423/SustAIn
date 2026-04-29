export type UnitSystem = "metric" | "imperial";

const ML_PER_FL_OZ = 29.5735;
const FL_OZ_PER_ML = 1 / ML_PER_FL_OZ;

export const DEFAULT_BOTTLE_ML = 500;
export const DEFAULT_BOTTLE_FL_OZ = DEFAULT_BOTTLE_ML * FL_OZ_PER_ML;

export function mlToDisplay(ml: number, system: UnitSystem): number {
  return system === "imperial" ? ml * FL_OZ_PER_ML : ml;
}

export function getUnit(system: UnitSystem): string {
  return system === "imperial" ? "fl oz" : "ml";
}

export function getBottleSizeDisplay(system: UnitSystem): number {
  return system === "imperial" ? DEFAULT_BOTTLE_FL_OZ : DEFAULT_BOTTLE_ML;
}

export function mlToBottles(ml: number, bottleSizeMl: number): number {
  if (bottleSizeMl <= 0) return 0;
  return ml / bottleSizeMl;
}

export interface UnitContext {
  system: UnitSystem;
  unit: string;
  bottleSizeMl: number;
  bottleSizeDisplay: number;
}

export function makeUnitContext(system: UnitSystem, bottleSizeMl?: number): UnitContext {
  const resolvedBottleMl = bottleSizeMl ?? DEFAULT_BOTTLE_ML;
  return {
    system,
    unit: getUnit(system),
    bottleSizeMl: resolvedBottleMl,
    bottleSizeDisplay:
      system === "imperial" ? resolvedBottleMl * FL_OZ_PER_ML : resolvedBottleMl,
  };
}
