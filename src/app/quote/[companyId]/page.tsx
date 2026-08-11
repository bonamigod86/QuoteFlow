"use client";

import { use, useEffect, useState } from "react";
import { supabase, type Company } from "@/lib/supabase";
import {
  calculatePrice,
  type ServiceType,
  type DrivewaySize,
} from "@/lib/pricing";

type Step = "service" | "property" | "addons" | "estimate" | "schedule" | "contact";

const SERVICE_OPTIONS: {
  value: ServiceType;
  title: string;
  description: string;
}[] = [
  {
    value: "house",
    title: "House Wash",
    description: "Exterior house cleaning",
  },
  {
    value: "driveway",
    title: "Driveway / Patio",
    description: "Concrete and outdoor surfaces",
  },
  {
    value: "both",
    title: "House + Driveway",
    description: "Complete exterior package",
  },
];

const DRIVEWAY_OPTIONS: {
  value: DrivewaySize;
  title: string;
  detail: string;
}[] = [
  { value: "small", title: "Small", detail: "1–2 cars" },
  { value: "medium", title: "Medium", detail: "2–3 cars" },
  { value: "large", title: "Large", detail: "4+ cars" },
];

const STEPS: { id: Step; label: string }[] = [
  { id: "service", label: "Service" },
  { id: "property", label: "Property" },
  { id: "addons", label: "Add-ons" },
  { id: "estimate", label: "Estimate" },
  { id: "schedule", label: "Schedule" },
  { id: "contact", label: "Contact" },
];

const SERVICE_LABELS: Record<ServiceType, string> = {
  house: "House Wash Only",
  driveway: "Driveway / Patio Only",
  both: "House + Driveway",
};

export default function QuotePage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = use(params);

  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("service");
  const [serviceType, setServiceType] = useState<ServiceType | null>(null);
  const [sqftKnown, setSqftKnown] = useState(true);
  const [sqftSize, setSqftSize] = useState("");
  const [drivewaySize, setDrivewaySize] = useState<DrivewaySize | null>(null);
  const [hasRoofCleaning, setHasRoofCleaning] = useState(false);
  const [hasGutterCleaning, setHasGutterCleaning] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [zipCode, setZipCode] = useState("");

  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTimeSlot, setPreferredTimeSlot] = useState<"morning" | "afternoon">(
    "morning"
  );

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedQuote, setSubmittedQuote] = useState<{
    total: number;
    type: "instant" | "custom";
  } | null>(null);

  useEffect(() => {
    async function loadCompany() {
      try {
        const { data, error } = await supabase
          .from("companies")
          .select("*")
          .eq("id", companyId)
          .single();

        if (error) {
          throw new Error(
            "We couldn't find this company. Please check the link and try again."
          );
        }

        setCompany(data as Company);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong. Please try again later."
        );
      } finally {
        setLoading(false);
      }
    }

    loadCompany();
  }, [companyId]);

  const includesHouse = serviceType === "house" || serviceType === "both";
  const includesDriveway = serviceType === "driveway" || serviceType === "both";

  const sqft = parseFloat(sqftSize) || 0;

  const pricing = company
    ? calculatePrice(company, {
        serviceType: serviceType ?? "house",
        squareFeet: sqftKnown ? sqft : 0,
        drivewaySize: includesDriveway ? drivewaySize : null,
        addons: { roof: hasRoofCleaning, gutter: hasGutterCleaning },
      })
    : null;

  const customQuote = pricing?.quoteType === "custom";

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const minPreferredDate = tomorrow;

  function propertyValid(): boolean {
    if (!serviceType) return false;
    if (includesHouse && sqftKnown) return sqft > 0;
    if (includesDriveway) return drivewaySize !== null;
    return true;
  }

  function contactValid(): boolean {
    return (
      fullName.trim().length >= 2 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) &&
      /^[\d\s().+-]{7,20}$/.test(phone.trim()) &&
      address.trim().length >= 5 &&
      /^\d{5}(-\d{4})?$/.test(zipCode.trim())
    );
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  function goTo(target: Step) {
    setSubmitError(null);
    setStep(target);
  }

  function canContinue(): boolean {
    if (step === "service") return serviceType !== null;
    if (step === "property") return propertyValid();
    if (step === "addons") return true;
    if (step === "estimate") return true;
    if (step === "schedule") return true;
    return contactValid();
  }

  function handleContinue() {
    if (!canContinue()) return;
    const next = STEPS[stepIndex + 1];
    if (next) goTo(next.id);
  }

  function handleBack() {
    const prev = STEPS[stepIndex - 1];
    if (prev) goTo(prev.id);
  }

  function formatUsDate(value: string): string {
    const parsed = new Date(value + "T00:00:00");
    if (isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    });
  }

  function handleReset() {
    setStep("service");
    setServiceType(null);
    setSqftKnown(true);
    setSqftSize("");
    setDrivewaySize(null);
    setHasRoofCleaning(false);
    setHasGutterCleaning(false);
    setFullName("");
    setEmail("");
    setPhone("");
    setAddress("");
    setZipCode("");
    setPreferredDate("");
    setPreferredTimeSlot("morning");
    setSubmitError(null);
    setSubmittedQuote(null);
  }

  useEffect(() => {
    let raf = 0;

    function notifyParent() {
      const height = document.documentElement.scrollHeight;
      if (window.parent !== window) {
        window.parent.postMessage({ type: "quoteflow:resize", height }, "*");
      }
    }

    function scheduleNotify() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(notifyParent);
    }

    notifyParent();

    const observer = new ResizeObserver(scheduleNotify);
    observer.observe(document.body);
    window.addEventListener("resize", scheduleNotify);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", scheduleNotify);
    };
  }, [loading, company, step, pricing, serviceType, sqftKnown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!company || !contactValid()) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: company.id,
          serviceType,
          serviceLabel: serviceType ? SERVICE_LABELS[serviceType] : "",
          squareFeet: sqftKnown ? sqft : 0,
          squareFeetKnown: sqftKnown,
          drivewaySize: includesDriveway ? drivewaySize : null,
          addons: { roof: hasRoofCleaning, gutter: hasGutterCleaning },
          customerName: fullName.trim(),
          customerEmail: email.trim(),
          customerPhone: phone.trim(),
          serviceAddress: address.trim(),
          zipCode: zipCode.trim(),
          preferredDate: preferredDate || null,
          preferredTimeWindow: preferredTimeSlot,
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        quoteType?: "instant" | "custom";
        total?: number;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        throw new Error(
          data.error ?? "We couldn't submit your request. Please try again."
        );
      }

      setSubmittedQuote({
        total: data.total ?? 0,
        type: data.quoteType ?? "custom",
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <p className="text-lg text-slate-500">Loading...</p>
      </main>
    );
  }

  if (error || !company) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <h1 className="text-xl font-semibold text-slate-900 mb-3">
            Quote Unavailable
          </h1>
          <p className="text-slate-600 mb-6">
            We couldn't find this company. Please check the link and try again.
          </p>
          <a
            href="mailto:support@quoteflow.com"
            className="inline-block px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
          >
            Contact Support
          </a>
        </div>
      </main>
    );
  }

  if (submittedQuote) {
    return (
      <main className="min-h-screen bg-slate-50 py-10 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 sm:p-10">
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <svg
                  className="h-8 w-8 text-emerald-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-slate-900">
                Request Received
              </h1>
              <p className="text-slate-600 mt-2 max-w-md">
                Your estimate request has been successfully sent to{" "}
                {company.company_name}.
              </p>
            </div>

            <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-6 space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Service</span>
                <span className="font-medium text-slate-900">
                  {serviceType ? SERVICE_LABELS[serviceType] : ""}
                </span>
              </div>
              {includesHouse && sqft > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Property Size</span>
                  <span className="font-medium text-slate-900">
                    {sqft.toLocaleString()} sq ft
                  </span>
                </div>
              )}
              {!customQuote && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Estimated Total</span>
                    <span className="font-bold text-slate-900">
                      ${submittedQuote.total.toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-4 space-y-1.5 border-t border-slate-200 pt-4">
                    {pricing?.lineItems.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-slate-600">{item.label}</span>
                        <span className="font-medium text-slate-900">
                          ${item.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Preferred Date</span>
                <span className="font-medium text-slate-900">
                  {preferredDate ? formatUsDate(preferredDate) : "Flexible"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Preferred Time</span>
                <span className="font-medium text-slate-900">
                  {preferredTimeSlot === "morning"
                    ? "Morning · 8 AM – 12 PM"
                    : "Afternoon · 12 PM – 5 PM"}
                </span>
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">
                What happens next?
              </h3>
              <ul className="space-y-2.5 text-sm text-slate-600">
                {[
                  "Your request was sent",
                  "The business will review your estimate",
                  "They'll confirm your service time",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <svg
                      className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="mt-8 w-full rounded-lg border border-slate-300 bg-white px-6 py-3 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition"
            >
              Submit Another Request
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 py-6 px-4">
      <div className="max-w-2xl mx-auto">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
        >
          <div className="bg-slate-900 px-6 py-6 sm:px-8">
            <p className="text-sm text-slate-400 mb-1">Instant Estimate</p>
            <h1 className="text-2xl font-bold text-white">
              {company.company_name}
            </h1>
            <p className="text-slate-300 text-sm mt-1">
              Tell us about your property and get an instant estimate.
            </p>
          </div>

          <div className="px-6 sm:px-8 pt-5">
            <ol className="flex items-center gap-1">
              {STEPS.map((s, i) => (
                <li key={s.id} className="flex-1">
                  <div
                    className={`h-1.5 rounded-full transition-colors ${
                      i <= stepIndex ? "bg-slate-900" : "bg-slate-200"
                    }`}
                  />
                </li>
              ))}
            </ol>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
                {STEPS[stepIndex].label}
              </p>
              <p className="text-xs text-slate-400">
                Step {stepIndex + 1} of {STEPS.length}
              </p>
            </div>
          </div>

          <div className="px-6 sm:px-8 py-6">
            {step === "service" && (
              <section>
                <h2 className="text-lg font-bold text-slate-900 mb-1">
                  What would you like cleaned?
                </h2>
                <p className="text-sm text-slate-500 mb-5">
                  Select the service that best matches your property.
                </p>
                <div className="space-y-3">
                  {SERVICE_OPTIONS.map((option) => {
                    const selected = serviceType === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setServiceType(option.value)}
                        className={`w-full rounded-xl border-2 p-5 text-left transition ${
                          selected
                            ? "border-slate-900 bg-slate-50"
                            : "border-slate-200 bg-white hover:border-slate-400"
                        }`}
                      >
                        <span className="flex items-start justify-between">
                          <span className="block font-semibold text-slate-900">
                            {option.title}
                          </span>
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                              selected
                                ? "border-slate-900 bg-slate-900"
                                : "border-slate-300"
                            }`}
                          >
                            {selected && (
                              <svg
                                className="h-3 w-3 text-white"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={3}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </span>
                        </span>
                        <span className="block text-sm text-slate-500 mt-1">
                          {option.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {step === "property" && (
              <section className="space-y-7">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 mb-1">
                    Tell us about your property
                  </h2>
                  <p className="text-sm text-slate-500">
                    We'll use this information to calculate your estimate.
                  </p>
                </div>

                {includesHouse && (
                  <div>
                    {sqftKnown ? (
                      <>
                        <label
                          htmlFor="sqft"
                          className="block text-sm font-medium text-slate-700 mb-2"
                        >
                          Home Size
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            id="sqft"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            value={sqftSize}
                            onChange={(e) => setSqftSize(e.target.value)}
                            placeholder="e.g. 2400"
                            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-lg text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                          />
                          <span className="text-sm text-slate-500 font-medium">
                            sq ft
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                          Don't know your home's square footage?
                        </p>
                        <button
                          type="button"
                          onClick={() => setSqftKnown(false)}
                          className="mt-1 text-sm font-semibold text-slate-900 underline underline-offset-2 hover:text-slate-600"
                        >
                          I'll enter my address instead
                        </button>
                      </>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
                        <p className="text-sm text-slate-700 mb-2">
                          That's okay — no square footage needed.
                        </p>
                        <p className="text-sm text-slate-500">
                          We'll use the property information you provide to
                          prepare your estimate. A team member may reach out to
                          confirm details.
                        </p>
                        <button
                          type="button"
                          onClick={() => setSqftKnown(true)}
                          className="mt-3 text-sm font-semibold text-slate-900 underline underline-offset-2 hover:text-slate-600"
                        >
                          I know my home's size
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {includesDriveway && (
                  <div>
                    <p className="block text-sm font-medium text-slate-700 mb-3">
                      How large is the driveway?
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {DRIVEWAY_OPTIONS.map((option) => {
                        const fee =
                          option.value === "small"
                            ? company.driveway_small_fee
                            : option.value === "medium"
                            ? company.driveway_medium_fee
                            : company.driveway_large_fee;
                        const selected = drivewaySize === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setDrivewaySize(option.value)}
                            className={`flex flex-col items-center rounded-xl border-2 p-4 text-center transition ${
                              selected
                                ? "border-slate-900 bg-slate-50"
                                : "border-slate-200 bg-white hover:border-slate-400"
                            }`}
                          >
                            <span className="text-sm font-semibold text-slate-900">
                              {option.title}
                            </span>
                            <span className="text-xs text-slate-500 mt-0.5">
                              {option.detail}
                            </span>
                            <span className="text-sm font-bold text-slate-900 mt-1.5">
                              ${fee.toFixed(0)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            )}

            {step === "addons" && (
              <section>
                <h2 className="text-lg font-bold text-slate-900 mb-1">
                  Add extra services
                </h2>
                <p className="text-sm text-slate-500 mb-5">
                  Optional add-ons. Your estimate updates right away.
                </p>
                <div className="space-y-3">
                  {[
                    {
                      label: "Roof Cleaning",
                      enabled: hasRoofCleaning,
                      toggle: () => setHasRoofCleaning((v) => !v),
                      fee: company.roof_cleaning_addon,
                    },
                    {
                      label: "Gutter Cleaning",
                      enabled: hasGutterCleaning,
                      toggle: () => setHasGutterCleaning((v) => !v),
                      fee: company.gutter_cleaning_addon,
                    },
                  ].map((addon) => (
                    <button
                      key={addon.label}
                      type="button"
                      onClick={addon.toggle}
                      className={`w-full flex items-center justify-between rounded-xl border-2 p-4 transition ${
                        addon.enabled
                          ? "border-slate-900 bg-slate-50"
                          : "border-slate-200 bg-white hover:border-slate-400"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded border-2 ${
                            addon.enabled
                              ? "border-slate-900 bg-slate-900"
                              : "border-slate-300"
                          }`}
                        >
                          {addon.enabled && (
                            <svg
                              className="h-3 w-3 text-white"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </span>
                        <span className="text-sm font-medium text-slate-900">
                          {addon.label}
                        </span>
                      </span>
                      <span className="text-sm font-semibold text-slate-700">
                        +${addon.fee.toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {step === "estimate" && pricing && (
              <section>
                <h2 className="text-lg font-bold text-slate-900 mb-1">
                  Your Estimated Price
                </h2>
                <p className="text-sm text-slate-500 mb-5">
                  Based on the information you provided.
                </p>

                {customQuote ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6">
                    <p className="text-sm text-slate-700 mb-2">
                      We'll need to review this property before providing a
                      final price.
                    </p>
                    <p className="text-sm text-slate-500">
                      Your request has been sent to {company.company_name}. A
                      team member will be in touch with a custom quote.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                      <p className="text-sm text-slate-500">Estimated Total</p>
                      <p className="text-4xl font-bold text-slate-900 mt-1">
                        ${pricing.total.toFixed(2)}
                      </p>
                      <p className="text-xs text-slate-400 mt-2">
                        Final pricing may be confirmed by the service provider.
                      </p>
                    </div>
                    <div className="mt-4 rounded-xl border border-slate-200 p-6">
                      <div className="space-y-2.5">
                        {pricing.lineItems.map((item, i) => (
                          <div
                            key={i}
                            className="flex items-start justify-between text-sm"
                          >
                            <div>
                              <p className="font-medium text-slate-900">
                                {item.label}
                              </p>
                              {item.detail && (
                                <p className="text-xs text-slate-400">
                                  {item.detail}
                                </p>
                              )}
                            </div>
                            <span className="font-medium text-slate-900">
                              ${item.amount.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
                        <span className="text-sm font-semibold text-slate-900">
                          Estimated Total
                        </span>
                        <span className="text-lg font-bold text-slate-900">
                          ${pricing.total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </section>
            )}

            {step === "schedule" && (
              <section>
                <h2 className="text-lg font-bold text-slate-900 mb-1">
                  When would you like us to come?
                </h2>
                <p className="text-sm text-slate-500 mb-5">
                  Let us know your preferred date and time window. We'll
                  confirm availability with you.
                </p>
                <div className="space-y-6">
                  <div>
                    <label
                      htmlFor="preferredDate"
                      className="block text-sm font-medium text-slate-700 mb-2"
                    >
                      Preferred Date
                    </label>
                    <input
                      id="preferredDate"
                      type="date"
                      lang="en-US"
                      min={minPreferredDate}
                      value={preferredDate}
                      onChange={(e) => setPreferredDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                  <div>
                    <p className="block text-sm font-medium text-slate-700 mb-2">
                      Preferred Time
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPreferredTimeSlot("morning")}
                        className={`rounded-xl border-2 p-4 text-left transition ${
                          preferredTimeSlot === "morning"
                            ? "border-slate-900 bg-slate-50"
                            : "border-slate-200 bg-white hover:border-slate-400"
                        }`}
                      >
                        <span className="block text-sm font-semibold text-slate-900">
                          Morning
                        </span>
                        <span className="block text-xs text-slate-500 mt-1">
                          8 AM – 12 PM
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreferredTimeSlot("afternoon")}
                        className={`rounded-xl border-2 p-4 text-left transition ${
                          preferredTimeSlot === "afternoon"
                            ? "border-slate-900 bg-slate-50"
                            : "border-slate-200 bg-white hover:border-slate-400"
                        }`}
                      >
                        <span className="block text-sm font-semibold text-slate-900">
                          Afternoon
                        </span>
                        <span className="block text-xs text-slate-500 mt-1">
                          12 PM – 5 PM
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {step === "contact" && (
              <section>
                <h2 className="text-lg font-bold text-slate-900 mb-1">
                  Where should we send your estimate?
                </h2>
                <p className="text-sm text-slate-500 mb-5">
                  We'll reach out to confirm your service time.
                </p>
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="fullName"
                      className="block text-sm font-medium text-slate-700 mb-2"
                    >
                      Full Name
                    </label>
                    <input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="John Smith"
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="email"
                        className="block text-sm font-medium text-slate-700 mb-2"
                      >
                        Email Address
                      </label>
                      <input
                        id="email"
                        type="email"
                        inputMode="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="john@example.com"
                        className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="phone"
                        className="block text-sm font-medium text-slate-700 mb-2"
                      >
                        Phone Number
                      </label>
                      <input
                        id="phone"
                        type="tel"
                        inputMode="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(555) 123-4567"
                        className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="address"
                      className="block text-sm font-medium text-slate-700 mb-2"
                    >
                      Service Address
                    </label>
                    <input
                      id="address"
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="123 Main St"
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="zipCode"
                      className="block text-sm font-medium text-slate-700 mb-2"
                    >
                      ZIP Code
                    </label>
                    <input
                      id="zipCode"
                      type="text"
                      inputMode="numeric"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      placeholder="78701"
                      maxLength={10}
                      className="w-full sm:w-60 rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                </div>
              </section>
            )}
          </div>

          <div className="border-t border-slate-200 bg-white px-6 sm:px-8 py-5 flex items-center gap-3">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={handleBack}
                className="px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 transition"
              >
                Back
              </button>
            )}
            <div className="flex-1" />
            {step !== "contact" ? (
              <button
                type="button"
                onClick={handleContinue}
                disabled={!canContinue()}
                className="px-6 py-3 rounded-lg bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Continue
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting || !contactValid()}
                className="px-6 py-3 rounded-lg bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {submitting ? "Submitting..." : "Get My Instant Estimate"}
              </button>
            )}
          </div>

          {step === "estimate" && pricing && !customQuote && (
            <div className="border-t border-slate-200 bg-slate-50 px-6 sm:px-8 py-4 flex items-center justify-between">
              <span className="text-sm text-slate-500">Estimated Total</span>
              <span className="text-2xl font-bold text-slate-900">
                ${pricing.total.toFixed(2)}
              </span>
            </div>
          )}

          {submitError && (
            <div className="px-6 sm:px-8 pb-5">
              <p className="text-sm text-red-600">{submitError}</p>
            </div>
          )}
        </form>
      </div>
    </main>
  );
}