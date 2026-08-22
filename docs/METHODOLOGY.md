# Research methodology

Verified through August 21, 2026.

This document defines what SustAIn estimates, how each number is calculated, which sources support the defaults, and where the calculation stops. It is written so that a result can be reproduced without trusting the SDK as a black box.

## 1. System boundary

SustAIn estimates operational inference impacts for a text request. The default boundary includes:

1. Facility electricity assigned to inference.
2. Direct site water consumed per unit of IT electricity.
3. Water consumed in generating facility electricity.
4. Operational carbon from facility electricity.

The boundary excludes training, fine-tuning, model development experiments, embodied impacts, chip fabrication, server manufacturing, data-center construction, client devices, network equipment, and end-of-life processing. Cache results exclude the cache service’s own infrastructure. Image, audio, and video generation require separate workload models.

## 2. Terms and units

| Term                        |           Unit | Definition                                                                                                         |
| --------------------------- | -------------: | ------------------------------------------------------------------------------------------------------------------ |
| Facility energy             |            kWh | Electricity attributed to the full facility boundary for the inference request.                                    |
| IT energy                   |            kWh | Facility energy divided by PUE.                                                                                    |
| PUE                         |          ratio | Total facility energy divided by IT equipment energy. Lower is more efficient; it cannot be below 1 in this model. |
| Site WUE                    |       L/kWh-IT | Water consumed at the data center divided by IT equipment energy.                                                  |
| Electricity water intensity | L/kWh-facility | Water consumed by the electricity system per delivered facility kWh.                                               |
| Direct water                |             mL | Site water consumption assigned to the request.                                                                    |
| Electricity water           |             mL | Power-generation water consumption assigned to the request.                                                        |
| Combined operational water  |             mL | Direct water plus electricity water.                                                                               |
| Water consumption           |         volume | Water not returned promptly to the original source, commonly because it evaporates.                                |
| Water withdrawal            |         volume | Water removed from a source before returned and consumed fractions are distinguished.                              |

The SDK does not combine consumption and withdrawal. It does not apply a water-scarcity weighting.

## 3. Energy estimator

### 3.1 Reference measurement

The default reference is 0.31 Wh for an optimized frontier-model production query. Microsoft’s peer-reviewed 2026 study reports a median of 0.31 Wh per query and an interquartile range of 0.16 to 0.60 Wh. Its ordinary reference workload is approximately 300 output tokens.

Source: [Microsoft Research, Energy Use of AI Inference: Efficiency Pathways and Test-Time Scaling](https://www.microsoft.com/en-us/research/publication/energy-use-of-ai-inference-efficiency-pathways-and-test-time-scaling/).

SustAIn adds a disclosed 100-input-token normalization assumption. The paper does not establish that every measured request contained exactly 100 input tokens.

### 3.2 Weighted tokens

Output generation is autoregressive and normally costs more per token than processing the input. The estimator uses:

```text
input weight  = 0.2
output weight = 1.0

weighted tokens = input tokens × 0.2 + output tokens × 1.0
reference weighted tokens = 100 × 0.2 + 300 × 1.0 = 320
```

The 5:1 output-to-input weighting is a modeling choice. It should be calibrated when measured deployment data is available.

### 3.3 Model multiplier

```text
estimated energy Wh =
  0.31 Wh
  × model multiplier
  × weighted request tokens / 320
```

Default class multipliers:

| Class  | Multiplier | Purpose                                                     |
| ------ | ---------: | ----------------------------------------------------------- |
| Small  |       0.65 | Scenario for compact, low-active-parameter, or lite models. |
| Medium |       1.00 | Matches the reference query.                                |
| Large  |       1.75 | Scenario for large frontier or high-compute models.         |

Selected architecture-specific profiles override the class value. The multiplier is a transparent heuristic. Parameter count alone does not determine energy because mixture-of-experts activation, precision, memory traffic, batching, sequence length, parallelism, and hardware utilization all matter.

### 3.4 Range

```text
energy low  = point estimate × 0.16 / 0.31
energy high = point estimate × 0.60 / 0.31
```

This propagates the reference study’s interquartile scale. It is not a confidence interval and does not cover every deployment. SustAIn labels the result as modeled even when provider-native token counts are available.

### 3.5 Token source

SustAIn records one of three token sources:

- `provider`: token counts returned by the provider after inference.
- `estimated`: pre-call or fallback count based on roughly four characters per token plus message overhead.
- `cache`: no new provider inference occurred.

Character approximation is useful only as a guardrail. Provider tokenizers, languages, source code, whitespace, media, tool calls, cached input, and reasoning tokens can produce materially different counts.

## 4. Water estimator

The default configuration is:

```text
PUE                                  = 1.4
site WUE                             = 0.36 L/kWh-IT
electricity water consumption        = 4.52 L/kWh-facility
default scope                         = direct + electricity
```

Source: [DOE/LBNL 2024 United States Data Center Energy Usage Report](https://datacenters.lbl.gov/publications/2024-lbnl-data-center-energy-usage-report).

The report estimates U.S. data centers consumed 176 TWh in 2023, an average PUE of 1.4, site WUE above 0.36 L/kWh, and about 800 billion liters of indirect water associated with electricity generation. Dividing 800 billion liters by 176 billion kWh gives about 4.55 L/kWh; the SDK uses the report-aligned 4.52 L/kWh scenario constant retained in the implementation. This value does not represent the marginal hourly water intensity of a specific grid.

### 4.1 Direct water

```text
IT energy kWh = facility energy kWh / PUE

direct water mL =
  IT energy kWh
  × site WUE L/kWh-IT
  × 1,000 mL/L
```

### 4.2 Electricity-generation water

```text
electricity water mL =
  facility energy kWh
  × electricity water intensity L/kWh
  × 1,000 mL/L
```

### 4.3 Selected scope

```text
direct scope:
  water_ml = direct_water_ml

direct+electricity scope:
  water_ml = direct_water_ml + electricity_water_ml
```

The fields remain separate even under the combined scope. This prevents a direct-only provider disclosure from being compared accidentally with a broader estimate.

## 5. Thermodynamic check

Electrical energy becomes heat unless exported as useful work or stored. A useful order-of-magnitude check uses water’s latent heat of vaporization.

```text
1 kWh = 3.6 MJ
latent heat near cooling conditions ≈ 2.4 MJ/kg
ideal evaporated mass ≈ 3.6 / 2.4 = 1.5 kg per kWh
```

Since liquid water has a density near 1 kg/L under ordinary conditions, the result is about 1.5 L/kWh if evaporation alone rejects all heat. This calculation does not predict a facility’s WUE. It omits dry heat rejection, sensible heating, compressor and pump work, weather, blowdown, drift, heat reuse, and system controls.

Official engineering references:

- [NIST Thermophysical Properties of Fluid Systems](https://webbook.nist.gov/chemistry/fluid/)
- [DOE FEMP Cooling Water Efficiency Opportunities for Federal Data Centers](https://www.energy.gov/cmei/femp/cooling-water-efficiency-opportunities-federal-data-centers)
- [DOE FEMP Best Management Practice 10: Cooling Tower Management](https://www.energy.gov/cmei/femp/best-management-practice-10-cooling-tower-management)
- [ASHRAE data-center WUE definition](https://handbook.ashrae.org/Handbooks/A23/SI/A23_Ch20/a23_ch20_si.aspx)

## 6. Carbon estimator

```text
carbon gCO2e = facility energy kWh × grid intensity gCO2e/kWh
```

The default region table is a screening tool. Production reporting should use a documented location-based or market-based factor, the correct reporting year, and a stated temporal method. EPA eGRID is the official U.S. source used for regional verification: [EPA eGRID](https://www.epa.gov/egrid).

## 7. Savings and signed changes

SustAIn compares the selected model with the same token workload on a configured baseline model.

```text
signed water delta mL = baseline water - selected water

signed water delta percent =
  (baseline water - selected water) / baseline water × 100
```

A positive percentage means the selected scenario is lower. Zero means equal. A negative percentage means it is higher. The legacy `water_saved_percent` field is clamped at zero for compatibility, while `water_delta_percent` preserves the sign.

The comparison does not prove that a smaller model is better for a task. If it generates more tokens, fails, retries, invokes tools unnecessarily, or escalates to a larger model, total energy may increase.

## 8. Measured benchmarks and boundary alignment

### Google

Google measured a median Gemini Apps text prompt in May 2025 at 0.24 Wh, 0.03 gCO2e, and 0.26 mL of direct cooling water using a full-stack boundary. The paper also reports a narrow active-machine estimate of 0.10 Wh and 0.12 mL. The 2.4-fold energy difference demonstrates why server-only figures cannot be compared directly with full-stack figures.

Source: [Google, Measuring the Environmental Impact of Delivering AI at Google Scale](https://services.google.com/fh/files/misc/measuring_the_environmental_impact_of_delivering_ai_at_google_scale.pdf).

### Microsoft

Microsoft reports a 0.31 Wh optimized frontier-query median and a 0.16 to 0.60 Wh IQR. A long DeepSeek-R1 example consumed 10.6 Wh while producing 11,287 output tokens. The study identifies 8 to 20-fold combined efficiency potential across models, serving, and hardware. That is a technical opportunity range, not a guaranteed application saving.

Source: [Microsoft Research](https://www.microsoft.com/en-us/research/publication/energy-use-of-ai-inference-efficiency-pathways-and-test-time-scaling/) and [Microsoft Cloud engineering summary](https://www.microsoft.com/en-us/microsoft-cloud/blog/2026/06/15/scaling-ai-with-8-to-20x-energy-efficiency/).

Microsoft separately reports a 2025 fleet-average WUE of 0.27 L/kWh and describes newer closed-loop designs that can use zero evaporative operational water at the site. Zero direct evaporative water does not imply zero electricity-generation or lifecycle water.

Source: [Microsoft water-intensity report](https://blogs.microsoft.com/blog/2026/06/24/inside-microsofts-two-decade-push-to-cut-water-intensity-while-scaling-for-growth/).

### OpenAI

OpenAI’s public disclosure states 0.34 Wh and 0.000085 U.S. gallons of water for an average ChatGPT query. The water conversion is:

```text
0.000085 US gal × 3,785.411784 mL/US gal = 0.32176 mL
```

The disclosure does not publish a measurement paper or complete system boundary. SustAIn treats it as a provider statement, not an independent scientific measurement.

Sources: [Sam Altman, The Gentle Singularity](https://blog.samaltman.com/posts.atom) and [OpenAI Academy environmental-impact resource](https://academy.openai.com/en/public/clubs/higher-education-05x4z/resources/environmental-impact-of-ai).

## 9. Sensitivity examples

For a 0.31 Wh facility-energy query:

| Scenario                                                 |  PUE | Site WUE L/kWh-IT | Electricity water L/kWh | Direct mL | Electricity mL | Combined mL |
| -------------------------------------------------------- | ---: | ----------------: | ----------------------: | --------: | -------------: | ----------: |
| SDK U.S. average                                         | 1.40 |              0.36 |                    4.52 |     0.080 |          1.401 |       1.481 |
| Microsoft 2025 WUE, same grid assumption                 | 1.40 |              0.27 |                    4.52 |     0.060 |          1.401 |       1.461 |
| Closed-loop, zero site evaporation, same grid assumption | 1.40 |              0.00 |                    4.52 |     0.000 |          1.401 |       1.401 |
| Direct-only reporting boundary                           | 1.40 |              0.36 |                excluded |     0.080 |       excluded |       0.080 |

This table shows why a direct-water claim and a combined operational-water claim can differ by more than an order of magnitude while both calculations remain internally correct.

## 10. Calibration for production

Use the following evidence order:

1. Request-level energy telemetry from the serving platform.
2. Server or rack power measurements allocated by active accelerator time.
3. Provider-specific full-stack measurements for the same model and endpoint.
4. Facility PUE and WUE for the serving region and time period.
5. Hourly or annual power-generation water intensity for the relevant grid.
6. SustAIn defaults when no more specific evidence exists.

Pass a custom estimator when you have measurement data:

```ts
const ai = new SustainAI({
  customEstimator: (totalTokens, model) => {
    return measuredKwhPerToken[model] * totalTokens;
  },
  waterAccounting: {
    pue: measuredPue,
    siteWueLitersPerKwhIt: measuredSiteWue,
    electricityWaterLitersPerKwh: measuredGridWater,
    scope: "direct+electricity",
  },
});
```

Document the measurement window, sample size, hardware, quantization, batch size, utilization, token distribution, retry behavior, facility boundary, and uncertainty. Do not use a point estimate from one deployment as a universal property of a model family.

## 11. Interpretation rules

- Report the water scope beside every value.
- Keep direct and electricity water separate.
- State whether the number is measured, provider-disclosed, or modeled.
- Report input and output tokens separately.
- Include retries, escalations, and tool calls in application totals.
- Do not compare consumption with withdrawal.
- Do not convert operational water into a lifecycle claim.
- Do not describe a normalized model multiplier as a benchmark.
- Use signed changes when a model exceeds the baseline.
- Treat local water scarcity as a separate impact dimension.

## 12. Additional official sources

- [National Renewable Energy Laboratory, Operational Water Consumption and Withdrawal Factors for Electricity Generating Technologies](https://www.nrel.gov/docs/fy11osti/50900.pdf)
- [U.S. Department of Energy and Lawrence Berkeley National Laboratory, 2024 United States Data Center Energy Usage Report](https://datacenters.lbl.gov/publications/2024-lbnl-data-center-energy-usage-report)
- [U.S. Environmental Protection Agency, eGRID](https://www.epa.gov/egrid)
