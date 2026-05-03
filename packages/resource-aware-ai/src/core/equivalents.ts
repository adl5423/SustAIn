export const G_CO2_PER_KM = 120;
export const WH_PER_GOOGLE_SEARCH = 0.3;
export const WH_PER_SMARTPHONE_CHARGE = 19;
export const W_LED_BULB = 9;
export const ML_PER_SHOWER_SECOND = 158.33;

export interface Equivalents {
  google_searches: number;
  smartphone_charges: number;
  km_driven: number;
  led_bulb_hours: number;
  shower_seconds: number;
}

export function computeEquivalents(input: {
  energy_wh: number;
  water_ml: number;
  co2_g: number;
}): Equivalents {
  const energyWh = Math.max(0, input.energy_wh);
  const waterMl = Math.max(0, input.water_ml);
  const co2G = Math.max(0, input.co2_g);
  return {
    google_searches: energyWh / WH_PER_GOOGLE_SEARCH,
    smartphone_charges: energyWh / WH_PER_SMARTPHONE_CHARGE,
    km_driven: co2G / G_CO2_PER_KM,
    led_bulb_hours: energyWh / W_LED_BULB,
    shower_seconds: waterMl / ML_PER_SHOWER_SECOND,
  };
}

export const ZERO_EQUIVALENTS: Equivalents = {
  google_searches: 0,
  smartphone_charges: 0,
  km_driven: 0,
  led_bulb_hours: 0,
  shower_seconds: 0,
};
