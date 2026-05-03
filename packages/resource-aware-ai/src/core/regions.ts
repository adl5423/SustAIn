export interface RegionData {
  id: string;
  label: string;
  grid_g_per_kwh: number;
  source: string;
}

export const GRID_INTENSITIES: Record<string, RegionData> = {
  global: { id: "global", label: "Global average", grid_g_per_kwh: 481, source: "Ember Global Electricity Review 2023" },
  us: { id: "us", label: "United States (national avg)", grid_g_per_kwh: 369, source: "EPA eGRID 2022" },
  us_california: { id: "us_california", label: "USA — California (CAISO)", grid_g_per_kwh: 240, source: "EPA eGRID 2022" },
  us_texas: { id: "us_texas", label: "USA — Texas (ERCOT)", grid_g_per_kwh: 410, source: "EPA eGRID 2022" },
  us_virginia: { id: "us_virginia", label: "USA — Virginia (PJM, data-center heavy)", grid_g_per_kwh: 268, source: "EPA eGRID 2022" },
  us_washington: { id: "us_washington", label: "USA — Washington (hydro-heavy)", grid_g_per_kwh: 90, source: "EPA eGRID 2022" },
  eu: { id: "eu", label: "European Union (avg)", grid_g_per_kwh: 251, source: "Ember 2023" },
  fr: { id: "fr", label: "France (nuclear-heavy)", grid_g_per_kwh: 56, source: "Ember 2023" },
  de: { id: "de", label: "Germany", grid_g_per_kwh: 380, source: "Ember 2023" },
  uk: { id: "uk", label: "United Kingdom", grid_g_per_kwh: 207, source: "Ember 2023" },
  no: { id: "no", label: "Norway (hydro-heavy)", grid_g_per_kwh: 28, source: "Ember 2023" },
  se: { id: "se", label: "Sweden", grid_g_per_kwh: 41, source: "Ember 2023" },
  pl: { id: "pl", label: "Poland (coal-heavy)", grid_g_per_kwh: 661, source: "Ember 2023" },
  in: { id: "in", label: "India", grid_g_per_kwh: 713, source: "Ember 2023" },
  cn: { id: "cn", label: "China", grid_g_per_kwh: 581, source: "Ember 2023" },
  jp: { id: "jp", label: "Japan", grid_g_per_kwh: 480, source: "Ember 2023" },
  br: { id: "br", label: "Brazil (hydro-heavy)", grid_g_per_kwh: 102, source: "Ember 2023" },
  au: { id: "au", label: "Australia", grid_g_per_kwh: 549, source: "Ember 2023" },
  ca: { id: "ca", label: "Canada (hydro-heavy)", grid_g_per_kwh: 128, source: "Ember 2023" },
  za: { id: "za", label: "South Africa (coal-heavy)", grid_g_per_kwh: 829, source: "Ember 2023" },
  ae: { id: "ae", label: "UAE", grid_g_per_kwh: 469, source: "Ember 2023" },
  sg: { id: "sg", label: "Singapore", grid_g_per_kwh: 408, source: "Ember 2023" },
};

export const BASELINE_GRID_G_PER_KWH = 900;

export const DEFAULT_REGION = "global";

export function getGridIntensity(region: string): number {
  const entry = GRID_INTENSITIES[region];
  return entry ? entry.grid_g_per_kwh : GRID_INTENSITIES[DEFAULT_REGION]!.grid_g_per_kwh;
}

export function getRegionData(region: string): RegionData {
  return GRID_INTENSITIES[region] ?? GRID_INTENSITIES[DEFAULT_REGION]!;
}

export function listRegions(): RegionData[] {
  return Object.values(GRID_INTENSITIES);
}
