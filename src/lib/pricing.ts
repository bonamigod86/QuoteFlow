import type { Company } from "./supabase";

export type ServiceType = "house" | "driveway" | "both";
export type DrivewaySize = "small" | "medium" | "large";
export type QuoteType = "instant" | "custom";

export type Addons = {
  roof: boolean;
  gutter: boolean;
};

export type PricingInput = {
  serviceType: ServiceType;
  squareFeet: number;
  drivewaySize: DrivewaySize | null;
  addons: Addons;
};

export type PricingLineItem = {
  label: string;
  detail?: string;
  amount: number;
};

export type PricingResult = {
  quoteType: QuoteType;
  lineItems: PricingLineItem[];
  subtotal: number;
  minimumFeeApplied: number;
  total: number;
  snapshot: {
    config: Company;
    input: PricingInput;
    generatedAt: string;
  };
};

// Extensible rule model so future rules (two-story +20%, heavy buildup,
// large pavement tier, etc.) can be added without rewriting the engine.
type RuleType = "per_sqft" | "fixed" | "tier";

type Rule = {
  id: string;
  type: RuleType;
  applies: (input: PricingInput, company: Company) => boolean;
  compute: (input: PricingInput, company: Company) => PricingLineItem[];
};

const RULES: Rule[] = [
  {
    id: "house-wash",
    type: "per_sqft",
    applies: (input) => input.serviceType === "house" || input.serviceType === "both",
    compute: (input, company) => {
      const rate = company.house_wash_rate_per_sqft;
      return [
        {
          label: "House Wash",
          detail: `${input.squareFeet.toLocaleString()} sq ft × $${rate.toFixed(3)} / sq ft`,
          amount: input.squareFeet * rate,
        },
      ];
    },
  },
  {
    id: "driveway",
    type: "tier",
    applies: (input) =>
      (input.serviceType === "driveway" || input.serviceType === "both") &&
      input.drivewaySize !== null,
    compute: (input, company) => {
      const tiers: Record<DrivewaySize, { label: string; fee: number }> = {
        small: { label: "Driveway — Small (1–2 cars)", fee: company.driveway_small_fee },
        medium: { label: "Driveway — Medium (2–3 cars)", fee: company.driveway_medium_fee },
        large: { label: "Driveway — Large (4+ cars)", fee: company.driveway_large_fee },
      };
      const tier = tiers[input.drivewaySize as DrivewaySize];
      return [{ label: tier.label, amount: tier.fee }];
    },
  },
  {
    id: "roof-cleaning",
    type: "fixed",
    applies: (input) => input.addons.roof,
    compute: (_input, company) => [
      { label: "Roof Cleaning", amount: company.roof_cleaning_addon },
    ],
  },
  {
    id: "gutter-cleaning",
    type: "fixed",
    applies: (input) => input.addons.gutter,
    compute: (_input, company) => [
      { label: "Gutter Cleaning", amount: company.gutter_cleaning_addon },
    ],
  },
];

export function canPriceInstantly(input: PricingInput): boolean {
  const needsHouse = input.serviceType === "house" || input.serviceType === "both";
  const needsDriveway =
    input.serviceType === "driveway" || input.serviceType === "both";

  if (needsHouse && input.squareFeet <= 0) return false;
  if (needsDriveway && !input.drivewaySize) return false;
  return true;
}

export function calculatePrice(
  company: Company,
  input: PricingInput
): PricingResult {
  if (!canPriceInstantly(input)) {
    return {
      quoteType: "custom",
      lineItems: [],
      subtotal: 0,
      minimumFeeApplied: 0,
      total: 0,
      snapshot: {
        config: company,
        input,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  const lineItems = RULES.filter((r) => r.applies(input, company))
    .flatMap((r) => r.compute(input, company))
    .filter((li) => li.amount > 0);

  const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);
  const minFee = company.min_service_fee;
  const total = Math.max(subtotal, minFee);
  const minimumFeeApplied = subtotal < minFee ? minFee - subtotal : 0;

  if (minimumFeeApplied > 0) {
    lineItems.push({
      label: "Minimum Service Charge",
      detail: `Applied to reach the minimum`,
      amount: minimumFeeApplied,
    });
  }

  return {
    quoteType: "instant",
    lineItems,
    subtotal,
    minimumFeeApplied,
    total,
    snapshot: {
      config: company,
      input,
      generatedAt: new Date().toISOString(),
    },
  };
}