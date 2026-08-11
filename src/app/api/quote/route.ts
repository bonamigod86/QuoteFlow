import { NextRequest, NextResponse } from "next/server";
import { supabase, type Company } from "@/lib/supabase";
import {
  calculatePrice,
  canPriceInstantly,
  type PricingInput,
  type ServiceType,
  type DrivewaySize,
} from "@/lib/pricing";
import { sendQuoteNotifications } from "@/lib/notifications";

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const hitCounts = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const record = hitCounts.get(ip);
  if (!record || record.resetAt < now) {
    hitCounts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  record.count += 1;
  return record.count > RATE_LIMIT;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function isPhone(value: string): boolean {
  return /^[\d\s().+-]{7,20}$/.test(value);
}

function isZip(value: string): boolean {
  return /^\d{5}(-\d{4})?$/.test(value);
}

function parseInput(body: Record<string, unknown>): PricingInput | null {
  const serviceType = body.serviceType;
  if (
    serviceType !== "house" &&
    serviceType !== "driveway" &&
    serviceType !== "both"
  ) {
    return null;
  }

  const squareFeet =
    typeof body.squareFeet === "number" && Number.isFinite(body.squareFeet)
      ? Math.max(0, Math.min(100000, Math.floor(body.squareFeet)))
      : 0;

  let drivewaySize: DrivewaySize | null = null;
  if (
    body.drivewaySize === "small" ||
    body.drivewaySize === "medium" ||
    body.drivewaySize === "large"
  ) {
    drivewaySize = body.drivewaySize;
  }

  const addonsRaw = body.addons;
  const addons =
    addonsRaw && typeof addonsRaw === "object"
      ? {
          roof: (addonsRaw as { roof?: unknown }).roof === true,
          gutter: (addonsRaw as { gutter?: unknown }).gutter === true,
        }
      : { roof: false, gutter: false };

  return { serviceType: serviceType as ServiceType, squareFeet, drivewaySize, addons };
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const input = parseInput(body);
  if (!input) {
    return NextResponse.json(
      { error: "Please select a valid service." },
      { status: 400 }
    );
  }

  const name = String(body.customerName ?? "").trim().slice(0, 120);
  const email = String(body.customerEmail ?? "").trim().slice(0, 200);
  const phone = String(body.customerPhone ?? "").trim().slice(0, 30);
  const address = String(body.serviceAddress ?? "").trim().slice(0, 300);
  const zipCode = String(body.zipCode ?? "").trim().slice(0, 10);

  if (name.length < 2) {
    return NextResponse.json(
      { error: "Please enter your full name." },
      { status: 400 }
    );
  }
  if (!isEmail(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }
  if (!isPhone(phone)) {
    return NextResponse.json(
      { error: "Please enter a valid US phone number." },
      { status: 400 }
    );
  }
  if (!address || address.length < 5) {
    return NextResponse.json(
      { error: "Please enter your service address." },
      { status: 400 }
    );
  }
  if (!isZip(zipCode)) {
    return NextResponse.json(
      { error: "Please enter a valid ZIP code." },
      { status: 400 }
    );
  }

  const needsHouse = input.serviceType === "house" || input.serviceType === "both";
  const needsDriveway =
    input.serviceType === "driveway" || input.serviceType === "both";

  const squareFeetKnown = body.squareFeetKnown !== false;
  if (needsHouse && input.squareFeet <= 0 && squareFeetKnown) {
    return NextResponse.json(
      { error: "Please provide your home's square footage or choose custom quote." },
      { status: 400 }
    );
  }
  if (needsDriveway && !input.drivewaySize) {
    return NextResponse.json(
      { error: "Please select your driveway size." },
      { status: 400 }
    );
  }

  const preferredDate = String(body.preferredDate ?? "").trim();
  const validPreferredDate =
    preferredDate.length === 0 ||
    (/^\d{4}-\d{2}-\d{2}$/.test(preferredDate) &&
      !isNaN(new Date(preferredDate + "T00:00:00").getTime()));

  const timeWindow = body.preferredTimeWindow;
  if (timeWindow !== "morning" && timeWindow !== "afternoon" && timeWindow !== null) {
    return NextResponse.json({ error: "Invalid time window." }, { status: 400 });
  }
  if (!validPreferredDate) {
    return NextResponse.json(
      { error: "Invalid preferred date." },
      { status: 400 }
    );
  }

  const { data: companyData, error: companyError } = await supabase
    .from("companies")
    .select("*")
    .eq("id", String(body.companyId ?? ""))
    .single();

  if (companyError || !companyData) {
    return NextResponse.json(
      { error: "Company not found." },
      { status: 404 }
    );
  }

  const company = companyData as Company;

  const pricing = calculatePrice(company, input);
  const instant = canPriceInstantly(input);
  const quoteType: "instant" | "custom" = instant ? "instant" : "custom";

  const addonNames: string[] = [];
  if (input.addons.roof) addonNames.push("roof");
  if (input.addons.gutter) addonNames.push("gutter");

  const { error: insertError } = await supabase.from("quotes").insert({
    company_id: company.id,
    customer_name: name,
    customer_email: email,
    customer_phone: phone,
    service_address: address,
    zip_code: zipCode,
    service_type: body.serviceLabel as string,
    property_size: needsHouse ? input.squareFeet : null,
    driveway_size: input.drivewaySize,
    addons: addonNames,
    line_items: pricing.lineItems,
    subtotal: pricing.subtotal,
    total: pricing.total,
    quote_type: quoteType,
    status: "new",
    preferred_date: preferredDate || null,
    preferred_time_window: (timeWindow as "morning" | "afternoon") ?? null,
    pricing_snapshot: pricing.snapshot,
  });

  if (insertError) {
    return NextResponse.json(
      { error: "We couldn't save your request. Please try again." },
      { status: 500 }
    );
  }

  await sendQuoteNotifications({
    companyName: company.company_name,
    companyEmail: company.email,
    customerName: name,
    customerEmail: email,
    customerPhone: phone,
    serviceAddress: address,
    serviceLabel: String(body.serviceLabel ?? ""),
    estimatedValue: pricing.total,
    preferredDate,
    preferredTimeWindow: timeWindow,
  });

  return NextResponse.json({
    ok: true,
    quoteType,
    total: pricing.total,
  });
}