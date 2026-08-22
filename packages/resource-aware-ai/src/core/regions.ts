export interface RegionData {
  id: string;
  label: string;
  grid_g_per_kwh: number;
  source: string;
}

const EPA_EGRID_2023 = "EPA eGRID2023 Rev. 2 total CO2e output rate";
const EMBER_2024 = "Ember Global Electricity Review 2025 (2024 data)";
const EMBER_2023 = "Ember yearly electricity data (2023 snapshot)";

export const GRID_INTENSITIES: Record<string, RegionData> = {
  global: {
    id: "global",
    label: "Global average",
    grid_g_per_kwh: 473,
    source: EMBER_2024,
  },
  us: {
    id: "us",
    label: "United States national average",
    grid_g_per_kwh: 349.7,
    source: EPA_EGRID_2023,
  },
  us_california: {
    id: "us_california",
    label: "United States, California",
    grid_g_per_kwh: 179.1,
    source: EPA_EGRID_2023,
  },
  us_texas: {
    id: "us_texas",
    label: "United States, Texas",
    grid_g_per_kwh: 349.8,
    source: EPA_EGRID_2023,
  },
  us_virginia: {
    id: "us_virginia",
    label: "United States, Virginia",
    grid_g_per_kwh: 244.8,
    source: EPA_EGRID_2023,
  },
  us_washington: {
    id: "us_washington",
    label: "United States, Washington",
    grid_g_per_kwh: 120.9,
    source: EPA_EGRID_2023,
  },
  eu: {
    id: "eu",
    label: "European Union average",
    grid_g_per_kwh: 251,
    source: EMBER_2023,
  },
  fr: { id: "fr", label: "France", grid_g_per_kwh: 56, source: EMBER_2023 },
  de: { id: "de", label: "Germany", grid_g_per_kwh: 380, source: EMBER_2023 },
  uk: {
    id: "uk",
    label: "United Kingdom",
    grid_g_per_kwh: 207,
    source: EMBER_2023,
  },
  no: { id: "no", label: "Norway", grid_g_per_kwh: 28, source: EMBER_2023 },
  se: { id: "se", label: "Sweden", grid_g_per_kwh: 41, source: EMBER_2023 },
  pl: { id: "pl", label: "Poland", grid_g_per_kwh: 661, source: EMBER_2023 },
  in: { id: "in", label: "India", grid_g_per_kwh: 713, source: EMBER_2023 },
  cn: { id: "cn", label: "China", grid_g_per_kwh: 581, source: EMBER_2023 },
  jp: { id: "jp", label: "Japan", grid_g_per_kwh: 480, source: EMBER_2023 },
  br: { id: "br", label: "Brazil", grid_g_per_kwh: 102, source: EMBER_2023 },
  au: { id: "au", label: "Australia", grid_g_per_kwh: 549, source: EMBER_2023 },
  ca: { id: "ca", label: "Canada", grid_g_per_kwh: 128, source: EMBER_2023 },
  za: {
    id: "za",
    label: "South Africa",
    grid_g_per_kwh: 829,
    source: EMBER_2023,
  },
  ae: {
    id: "ae",
    label: "United Arab Emirates",
    grid_g_per_kwh: 469,
    source: EMBER_2023,
  },
  sg: { id: "sg", label: "Singapore", grid_g_per_kwh: 408, source: EMBER_2023 },
};

/** U.S. eGRID2023 average, retained as the exported baseline default. */
export const BASELINE_GRID_G_PER_KWH = 349.7;

export const DEFAULT_REGION = "us";

export function getGridIntensity(region: string): number {
  const entry = GRID_INTENSITIES[region];
  return entry
    ? entry.grid_g_per_kwh
    : GRID_INTENSITIES[DEFAULT_REGION]!.grid_g_per_kwh;
}

export function getRegionData(region: string): RegionData {
  return GRID_INTENSITIES[region] ?? GRID_INTENSITIES[DEFAULT_REGION]!;
}

export function listRegions(): RegionData[] {
  return Object.values(GRID_INTENSITIES);
}
