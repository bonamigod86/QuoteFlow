"use client";

import { useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase, type Company, type Quote, type QuoteStatus } from "@/lib/supabase";

const COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const WIDGET_URL = `http://localhost:3000/quote/${COMPANY_ID}`;
const EMBED_CODE = `<div id="quoteflow-widget"></div>\n<script src="http://localhost:3000/api/widget" data-company-id="${COMPANY_ID}" async></script>`;

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "booked", label: "Booked" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "declined", label: "Declined" },
  { value: "archived", label: "Archived" },
];

const STATUS_STYLES: Record<string, string> = {
  new: "bg-amber-100 text-amber-800",
  contacted: "bg-blue-100 text-blue-800",
  booked: "bg-emerald-100 text-emerald-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-slate-100 text-slate-500",
  declined: "bg-rose-100 text-rose-700",
  archived: "bg-slate-200 text-slate-400",
};

const PRICING_FIELDS: {
  key: Exclude<
    keyof Company,
    | "id"
    | "company_name"
    | "email"
    | "phone"
    | "website"
    | "address"
    | "created_at"
  >;
  label: string;
  description: string;
  step: string;
}[] = [
  {
    key: "min_service_fee",
    label: "Minimum Service Charge",
    description: "Lowest total we'll ever quote, even for small jobs.",
    step: "0.01",
  },
  {
    key: "house_wash_rate_per_sqft",
    label: "House Wash",
    description: "Price per sq ft of exterior cleaning.",
    step: "0.001",
  },
  {
    key: "driveway_small_fee",
    label: "Driveway — Small",
    description: "1–2 cars",
    step: "0.01",
  },
  {
    key: "driveway_medium_fee",
    label: "Driveway — Medium",
    description: "2–3 cars",
    step: "0.01",
  },
  {
    key: "driveway_large_fee",
    label: "Driveway — Large",
    description: "4+ cars",
    step: "0.01",
  },
  {
    key: "roof_cleaning_addon",
    label: "Roof Cleaning",
    description: "Add-on price per job.",
    step: "0.01",
  },
  {
    key: "gutter_cleaning_addon",
    label: "Gutter Cleaning",
    description: "Add-on price per job.",
    step: "0.01",
  },
];

export default function DashboardPage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [pricing, setPricing] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(true);

  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [{ data: companyData, error: companyError }, { data: quotesData, error: quotesError }] =
          await Promise.all([
            supabase.from("companies").select("*").eq("id", COMPANY_ID).single(),
            supabase
              .from("quotes")
              .select("*")
              .eq("company_id", COMPANY_ID)
              .order("created_at", { ascending: false }),
          ]);

        if (companyError) {
          throw new Error(
            "We couldn't load your pricing settings. Please try again."
          );
        }

        if (quotesError) {
          throw new Error(
            "We couldn't load your received quotes. Please try again."
          );
        }

        const companyRecord = companyData as Company;
        setCompany(companyRecord);

        const values: Record<string, string> = {};
        PRICING_FIELDS.forEach(({ key }) => {
          values[key] = String(companyRecord[key] ?? 0);
        });
        setPricing(values);
        setQuotes((quotesData as Quote[]) ?? []);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong. Please try again."
        );
      } finally {
        setLoading(false);
        setQuotesLoading(false);
      }
    }

    loadDashboard();
  }, []);

  function handlePricingChange(key: string, value: string) {
    setPricing((prev) => ({ ...prev, [key]: value }));
    setSavedMessage(null);
  }

  async function handleSaveChanges() {
    setPricingLoading(true);
    setSavedMessage(null);

    const updateData: Partial<Company> = {};
    PRICING_FIELDS.forEach(({ key }) => {
      updateData[key] = parseFloat(pricing[key]) || 0;
    });

    try {
      const { error } = await supabase
        .from("companies")
        .update(updateData)
        .eq("id", COMPANY_ID);

      if (error) {
        throw new Error("We couldn't save your changes. Please try again.");
      }

      setSavedMessage("Pricing settings saved successfully.");
    } catch (err) {
      setSavedMessage(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setPricingLoading(false);
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(WIDGET_URL);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = WIDGET_URL;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCopyEmbedCode() {
    try {
      await navigator.clipboard.writeText(EMBED_CODE);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = EMBED_CODE;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  async function handleStatusChange(quoteId: string, status: QuoteStatus) {
    const previous = quotes.find((q) => q.id === quoteId)?.status;
    setQuotes((prev) =>
      prev.map((q) => (q.id === quoteId ? { ...q, status } : q))
    );

    try {
      const { error } = await supabase
        .from("quotes")
        .update({ status })
        .eq("id", quoteId);

      if (error) {
        throw new Error("We couldn't update the quote status.");
      }
    } catch (err) {
      setQuotes((prev) =>
        prev.map((q) =>
          q.id === quoteId ? { ...q, status: previous ?? q.status } : q
        )
      );
      setSavedMessage(
        err instanceof Error ? err.message : "Something went wrong."
      );
    }
  }

  async function handleDeleteQuote(quoteId: string) {
    if (!window.confirm("Delete this quote permanently?")) return;

    try {
      const { error } = await supabase
        .from("quotes")
        .delete()
        .eq("id", quoteId);

      if (error) {
        throw new Error("We couldn't delete this quote.");
      }

      setQuotes((prev) => prev.filter((q) => q.id !== quoteId));
    } catch (err) {
      setSavedMessage(
        err instanceof Error ? err.message : "Something went wrong."
      );
    }
  }

  function formatDate(value: string | undefined) {
    if (!value) return "—";
    return new Date(value).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatScheduled(
    quote: Quote
  ): { date: string; slot: string } {
    const date = quote.preferred_date;
    if (!date) {
      return { date: "Flexible", slot: "Not Specified" };
    }
    return {
      date: new Date(date + "T00:00:00").toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      slot:
        quote.preferred_time_window === "afternoon"
          ? "Afternoon"
          : "Morning",
    };
  }

  function formatService(quote: Quote): string {
    const addons = (quote.addons as string[]) ?? [];
    const addonLabels = addons.map((a) =>
      a === "roof" ? "Roof" : a === "gutter" ? "Gutter" : a
    );
    return addonLabels.length > 0
      ? `${quote.service_type} + ${addonLabels.join(" & ")}`
      : quote.service_type;
  }

  function handleGeneratePDF(quote: Quote) {
    if (!company) return;

    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 48;
    const contentWidth = pageWidth - marginX * 2;

    const items: { description: string; amount: number }[] = [];

    const storedItems = (quote.line_items as { label?: string; detail?: string; amount?: number }[] | null) ?? null;
    const hasStoredItems = Array.isArray(storedItems) && storedItems.length > 0;

    if (hasStoredItems) {
      storedItems.forEach((item) => {
        items.push({
          description: item.label ?? "Service",
          amount: item.amount ?? 0,
        });
      });
    } else if (quote.quote_type === "custom") {
      items.push({
        description: "Custom Quote — Pricing Confirmed by Provider",
        amount: quote.total ?? 0,
      });
    } else {
      if (
        quote.service_type === "House Wash Only" ||
        quote.service_type === "Both House & Driveway"
      ) {
        const sqft = quote.property_size ?? 0;
        const houseTotal =
          sqft > 0
            ? Math.max(
                sqft * (company.house_wash_rate_per_sqft ?? 0),
                company.min_service_fee ?? 0
              )
            : company.min_service_fee ?? 0;
        items.push({
          description:
            sqft > 0
              ? `House Wash - ${sqft.toLocaleString("en-US")} sq ft @ $${(company.house_wash_rate_per_sqft ?? 0).toFixed(2)}/sq ft`
              : "House Wash - Minimum Service Fee",
          amount: houseTotal,
        });
      }

      if (
        quote.service_type === "Driveway / Patio Only" ||
        quote.service_type === "Both House & Driveway"
      ) {
        const sizeLabel =
          quote.driveway_size === "small"
            ? "Small (1-2 cars)"
            : quote.driveway_size === "large"
            ? "Large (4+ cars)"
            : "Medium (2-3 cars)";
        const fee =
          quote.driveway_size === "small"
            ? company.driveway_small_fee ?? 0
            : quote.driveway_size === "large"
            ? company.driveway_large_fee ?? 0
            : company.driveway_medium_fee ?? 0;
        items.push({
          description: `Driveway / Patio Cleaning - ${sizeLabel}`,
          amount: fee,
        });
      }

      const addons = (quote.addons as string[]) ?? [];
      if (addons.includes("roof")) {
        items.push({
          description: "Roof Cleaning Add-on",
          amount: company.roof_cleaning_addon ?? 0,
        });
      }

      if (addons.includes("gutter")) {
        items.push({
          description: "Gutter Cleaning Add-on",
          amount: company.gutter_cleaning_addon ?? 0,
        });
      }
    }

    if (items.length === 0) {
      items.push({
        description: "Pressure Washing Service",
        amount: quote.total ?? 0,
      });
    }

    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 110, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(company.company_name, marginX, 50);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(company.email, marginX, 70);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.text("QUOTE", pageWidth - marginX, 50, {
      align: "right",
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(203, 213, 225);
    doc.text(`Quote ID: ${quote.id}`, pageWidth - marginX, 70, {
      align: "right",
    });

    // Client details
    let y = 150;
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("CLIENT DETAILS", marginX, y);
    doc.setLineWidth(1);
    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, y + 6, pageWidth - marginX, y + 6);

    y += 24;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(quote.customer_name, marginX, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    y += 16;
    doc.text(`Phone: ${quote.customer_phone}`, marginX, y);
    y += 14;
    doc.text(`Email: ${quote.customer_email}`, marginX, y);
    y += 14;
    doc.text(`Service Address: ${quote.service_address}`, marginX, y);
    y += 14;
    doc.text(
      `Preferred Schedule: ${
        quote.preferred_date
          ? `${quote.preferred_date} (${
              quote.preferred_time_window === "afternoon"
                ? "Afternoon 12pm - 5pm"
                : "Morning 8am - 12pm"
            })`
          : "Flexible"
      }`,
      marginX,
      y
    );
    y += 14;
    doc.text(
      `Submitted: ${formatDate(
        (quote as Quote & { created_at?: string }).created_at
      )}`,
      marginX,
      y
    );

    // Itemized table
    y += 28;
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("ITEMIZED SERVICES", marginX, y);
    doc.line(marginX, y + 6, pageWidth - marginX, y + 6);

    autoTable(doc, {
      startY: y + 14,
      margin: { left: marginX, right: marginX },
      head: [["Service", "Amount"]],
      body: items.map((item) => [
        item.description,
        `$${item.amount.toFixed(2)}`,
      ]),
      theme: "grid",
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 10,
      },
      styles: {
        fontSize: 10,
        cellPadding: 8,
        textColor: [51, 65, 85],
      },
      columnStyles: {
        0: { cellWidth: contentWidth - 120 },
        1: { cellWidth: 120, halign: "right" },
      },
      didParseCell: (data) => {
        if ((data as { section?: string }).section === "body") {
          (data.cell as { styles?: { textColor?: number[] } }).styles = {
            ...data.cell.styles,
            textColor: [30, 41, 59],
          };
        }
      },
    });

    // Total
    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } })
      .lastAutoTable?.finalY ?? y + 40;
    const totalY = finalY + 36;

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(1);
    doc.line(marginX, totalY - 10, pageWidth - marginX, totalY - 10);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text("ESTIMATED TOTAL:", marginX, totalY);
    doc.text(
      quote.quote_type === "custom"
        ? "Custom — To Be Confirmed"
        : `$${(quote.total ?? 0).toFixed(2)}`,
      pageWidth - marginX,
      totalY,
      { align: "right" }
    );

    // Footer
    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, 740, pageWidth - marginX, 740);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(
      "Thank you for considering us! This quote is valid as submitted and final pricing may be confirmed by the service provider.",
      pageWidth / 2,
      762,
      { align: "center" }
    );

    const safeName = quote.customer_name
      .replace(/[^a-zA-Z0-9_ -]/g, "")
      .trim()
      .replace(/\s+/g, "_");
    doc.save(`Quote_${quote.id}_${safeName}.pdf`);
  }

  const totalQuotes = quotes.length;
  const newQuotes = quotes.filter((q) => q.status === "new").length;
  const pipelineValue = quotes.reduce(
    (sum, q) => sum + (q.total || 0),
    0
  );
  const bookedQuotes = quotes.filter((q) => q.status === "booked").length;
  const conversionBase = quotes.filter(
    (q) =>
      !["archived", "cancelled", "declined"].includes(q.status)
  ).length;
  const conversionRate =
    conversionBase > 0
      ? Math.round((bookedQuotes / conversionBase) * 100)
      : 0;

  const filteredQuotes = quotes.filter((q) => {
    const matchesStatus =
      statusFilter === "all" || q.status === statusFilter;
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch =
      term === "" ||
      q.customer_name.toLowerCase().includes(term) ||
      q.service_address.toLowerCase().includes(term);
    return matchesStatus && matchesSearch;
  });

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-slate-500">Loading dashboard...</p>
        </div>
      </main>
    );
  }

  if (error || !company) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <h1 className="text-xl font-semibold text-slate-900 mb-3">
            Dashboard Unavailable
          </h1>
          <p className="text-slate-600">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">
            {company.company_name} · {company.email}
          </p>
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <p className="text-sm font-medium text-slate-500 mb-2">
              Total Quotes
            </p>
            <p className="text-3xl font-bold text-slate-900">
              {totalQuotes}
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <p className="text-sm font-medium text-slate-500 mb-2">
              Pending Action
            </p>
            <p className="text-3xl font-bold text-amber-600">
              {newQuotes}
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <p className="text-sm font-medium text-slate-500 mb-2">
              Pipeline Value
            </p>
            <p className="text-3xl font-bold text-emerald-600">
              ${pipelineValue.toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <p className="text-sm font-medium text-slate-500 mb-2">
              Booked Jobs
            </p>
            <p className="text-3xl font-bold text-blue-600">
              {bookedQuotes}
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <p className="text-sm font-medium text-slate-500 mb-2">
              Conversion Rate
            </p>
            <p className="text-3xl font-bold text-slate-900">
              {conversionRate}%
            </p>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 sm:px-8 pb-0">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">
              Received Quotes
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              All quote requests submitted through your widget.
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
              <div className="relative w-full sm:max-w-xs">
                <svg
                  className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by client or address..."
                  className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { value: "all", label: "All" },
                  { value: "new", label: "New" },
                  { value: "contacted", label: "Contacted" },
                  { value: "booked", label: "Booked" },
                  { value: "completed", label: "Completed" },
                  { value: "cancelled", label: "Cancelled" },
                  { value: "declined", label: "Declined" },
                  { value: "archived", label: "Archived" },
                ].map((pill) => (
                  <button
                    key={pill.value}
                    type="button"
                    onClick={() => setStatusFilter(pill.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                      statusFilter === pill.value
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {quotesLoading ? (
            <div className="px-6 sm:px-8 py-8">
              <p className="text-sm text-slate-500">Loading quotes...</p>
            </div>
          ) : filteredQuotes.length === 0 ? (
            <div className="px-6 sm:px-8 py-12 text-center">
              <p className="text-slate-500 text-sm">
                {quotes.length === 0
                  ? "No quotes received yet. Share your widget link to start collecting leads."
                  : "No quotes match your filters."}
              </p>
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-y border-slate-200 bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                      <th className="px-6 sm:px-8 py-3 font-semibold">
                        Client & Date
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        Service & Location
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        Value & Status
                      </th>
                      <th className="px-6 sm:px-8 py-3 font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredQuotes.map((quote) => (
                      <tr
                        key={quote.id}
                        onClick={() => setSelectedQuote(quote)}
                        className="hover:bg-slate-50 align-top cursor-pointer"
                      >
                        <td className="px-6 sm:px-8 py-4">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedQuote(quote);
                            }}
                            className="font-semibold text-slate-900 hover:text-slate-600 hover:underline text-left"
                          >
                            {quote.customer_name}
                          </button>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {quote.customer_phone}
                          </p>
                          <p className="text-xs text-slate-500 truncate max-w-[220px]">
                            {quote.customer_email}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {formatDate(
                              (quote as Quote & { created_at?: string })
                                .created_at
                            )}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-medium text-slate-900">
                            {formatService(quote)}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 max-w-[240px] truncate">
                            {quote.service_address}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {quote.preferred_date
                              ? `${formatScheduled(quote).date} · ${formatScheduled(quote).slot}`
                              : "Flexible"}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-lg font-bold text-slate-900">
                            ${quote.total.toFixed(2)}
                          </p>
                          <div
                            className="relative mt-2 inline-flex items-center rounded-md border border-slate-200 bg-white shadow-sm"
                          >
                            <select
                              value={quote.status}
                              onChange={(e) =>
                                handleStatusChange(quote.id, e.target.value as QuoteStatus)
                              }
                              className={`appearance-none cursor-pointer rounded-md py-1.5 pl-3 pr-7 text-xs font-semibold uppercase border-0 focus:outline-none focus:ring-2 focus:ring-slate-400 ${
                                STATUS_STYLES[quote.status] ??
                                STATUS_STYLES.new
                              }`}
                            >
                              {STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <svg
                              className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                              />
                            </svg>
                          </div>
                        </td>
                        <td className="px-6 sm:px-8 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <a
                              href={`tel:${quote.customer_phone}`}
                              title={`Call ${quote.customer_phone}`}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                            >
                              <svg
                                className="h-3.5 w-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
                                />
                              </svg>
                              Call / Text
                            </a>
<a
                            href={`mailto:${quote.customer_email}?subject=${encodeURIComponent(
                              `Your Pressure Washing Quote - ${company.company_name}`
                            )}`}
                            title={`Email ${quote.customer_email}`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
                          >
                            <svg
                              className="h-3.5 w-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                              />
                            </svg>
                            Email
                          </a>
                          <button
                            type="button"
                            onClick={() => handleGeneratePDF(quote)}
                            title="Download PDF quote"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 text-white px-3 py-2 text-xs font-semibold hover:bg-slate-800 transition"
                          >
                            <svg
                              className="h-3.5 w-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                              />
                            </svg>
                            PDF Quote
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteQuote(quote.id)}
                            title="Delete quote"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                              />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

              <div className="md:hidden divide-y divide-slate-100">
                {filteredQuotes.map((quote) => (
                  <div
                    key={quote.id}
                    className="p-5 space-y-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <button
                          type="button"
                          onClick={() => setSelectedQuote(quote)}
                          className="font-semibold text-slate-900 hover:text-slate-600 hover:underline text-left"
                        >
                          {quote.customer_name}
                        </button>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {quote.customer_phone}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {quote.customer_email}
                        </p>
                      </div>
                      <p className="text-lg font-bold text-slate-900 shrink-0">
                        ${quote.total.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 text-sm">
                        {formatService(quote)}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {quote.service_address}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Submitted {formatDate(
                          (quote as Quote & { created_at?: string })
                            .created_at
                        )}
                        {quote.preferred_date &&
                          ` · Scheduled ${formatScheduled(quote).date} (${formatScheduled(quote).slot})`}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="relative inline-flex items-center rounded-md border border-slate-200 bg-white shadow-sm">
                        <select
                          value={quote.status}
                          onChange={(e) =>
                            handleStatusChange(quote.id, e.target.value as QuoteStatus)
                          }
                          className={`appearance-none cursor-pointer rounded-md py-1.5 pl-3 pr-7 text-xs font-semibold uppercase border-0 focus:outline-none focus:ring-2 focus:ring-slate-400 ${
                            STATUS_STYLES[quote.status] ??
                            STATUS_STYLES.new
                          }`}
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <svg
                          className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                          />
                        </svg>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={`tel:${quote.customer_phone}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                        >
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
                            />
                          </svg>
                          Call
                        </a>
                        <a
                          href={`mailto:${quote.customer_email}?subject=${encodeURIComponent(
                            `Your Pressure Washing Quote - ${company.company_name}`
                          )}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
                        >
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                            />
                          </svg>
                          Email
                        </a>
                        <button
                          type="button"
                          onClick={() => handleGeneratePDF(quote)}
                          title="Download PDF quote"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 text-white px-3 py-2 text-xs font-semibold hover:bg-slate-800 transition"
                        >
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                            />
                          </svg>
                          PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuote(quote.id)}
                          title="Delete quote"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">
            Widget Embed Link
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Paste this embed code into your website to let customers request
            instant quotes.
          </p>
          <div className="relative rounded-lg bg-slate-900 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-700 px-4 py-2.5">
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                Embed Code
              </span>
              <button
                type="button"
                onClick={handleCopyEmbedCode}
                className="px-3 py-1.5 rounded-md bg-slate-100 text-slate-900 font-semibold text-xs hover:bg-white transition"
              >
                {copiedCode ? "Copied!" : "Copy Embed Code"}
              </button>
            </div>
            <pre className="overflow-x-auto px-4 py-4 text-sm text-slate-100 leading-relaxed whitespace-pre">
              <code>{EMBED_CODE}</code>
            </pre>
          </div>
          <p className="text-xs text-slate-400 mt-4">
            Direct link:{" "}
            <button
              type="button"
              onClick={handleCopyLink}
              className="font-mono text-slate-500 hover:text-slate-900 underline underline-offset-2"
            >
              {WIDGET_URL}
            </button>{" "}
            {copied && <span className="text-emerald-600">Copied!</span>}
          </p>
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">
            Calculator Configuration
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            Configure the rates used to calculate instant quotes.
          </p>

          <div className="grid sm:grid-cols-2 gap-4">
            {PRICING_FIELDS.map(({ key, label, step }) => (
              <div key={key}>
                <label
                  htmlFor={`pricing-${key}`}
                  className="block text-sm font-medium text-slate-700 mb-2"
                >
                  {label}
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-500">
                    $
                  </span>
                  <input
                    id={`pricing-${key}`}
                    type="number"
                    min="0"
                    step={step}
                    value={pricing[key] ?? ""}
                    onChange={(e) => handlePricingChange(key, e.target.value)}
                    className="w-full rounded-lg border border-slate-300 py-2.5 pl-8 pr-4 text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-4">
            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={pricingLoading}
              className="px-5 py-2.5 rounded-lg bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {pricingLoading ? "Saving..." : "Save Changes"}
            </button>
            {savedMessage && (
              <p
                className={`text-sm ${
                  savedMessage.toLowerCase().includes("couldn't") ||
                  savedMessage.toLowerCase().includes("wrong")
                    ? "text-red-600"
                    : "text-emerald-600"
                }`}
              >
                {savedMessage}
              </p>
            )}
          </div>
        </section>
      </div>

      {selectedQuote && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/40"
          onClick={() => setSelectedQuote(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl"
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">
                Quote Details
              </h3>
              <button
                type="button"
                onClick={() => setSelectedQuote(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="px-6 py-6 space-y-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xl font-bold text-slate-900">
                    {selectedQuote.customer_name}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    {selectedQuote.customer_phone}
                  </p>
                  <p className="text-sm text-slate-500">
                    {selectedQuote.customer_email}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500">Estimated Total</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {selectedQuote.quote_type === "custom"
                      ? "Custom"
                      : `$${(selectedQuote.total ?? 0).toFixed(2)}`}
                  </p>
                  <span
                    className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                      STATUS_STYLES[selectedQuote.status] ?? STATUS_STYLES.new
                    }`}
                  >
                    {STATUS_OPTIONS.find(
                      (o) => o.value === selectedQuote.status
                    )?.label ?? selectedQuote.status}
                  </span>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Service
                  </h4>
                  <p className="text-sm font-medium text-slate-900">
                    {selectedQuote.service_type}
                  </p>
                  {selectedQuote.property_size != null &&
                    selectedQuote.property_size > 0 && (
                      <p className="text-xs text-slate-500 mt-1">
                        {selectedQuote.property_size.toLocaleString("en-US")} sq
                        ft
                      </p>
                    )}
                  {selectedQuote.driveway_size && (
                    <p className="text-xs text-slate-500 mt-1">
                      Driveway: {selectedQuote.driveway_size}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {((selectedQuote.addons as string[]) ?? []).map((a) => (
                      <span
                        key={a}
                        className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                      >
                        {a === "roof"
                          ? "Roof Cleaning"
                          : a === "gutter"
                          ? "Gutter Cleaning"
                          : a}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Schedule
                  </h4>
                  <p className="text-sm font-medium text-slate-900">
                    {selectedQuote.preferred_date
                      ? formatScheduled(selectedQuote).date
                      : "Flexible"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedQuote.preferred_date
                      ? formatScheduled(selectedQuote).slot
                      : "No preferred time"}
                  </p>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 mt-4">
                    Property
                  </h4>
                  <p className="text-sm font-medium text-slate-900">
                    {selectedQuote.service_address}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    ZIP: {selectedQuote.zip_code ?? "—"}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Pricing
                </h4>
                {selectedQuote.quote_type === "custom" ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
                    <p className="text-sm text-slate-700">
                      Custom quote — pricing to be confirmed by the provider.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 p-5 space-y-2.5">
                    {(
                      (selectedQuote.line_items as
                        | { label?: string; amount?: number }[]
                        | null) ?? []
                    ).map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-slate-600">{item.label}</span>
                        <span className="font-medium text-slate-900">
                          ${(item.amount ?? 0).toFixed(2)}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                      <span className="text-sm font-semibold text-slate-900">
                        Estimated Total
                      </span>
                      <span className="text-lg font-bold text-slate-900">
                        ${(selectedQuote.total ?? 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`tel:${selectedQuote.customer_phone}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition"
                >
                  Call / Text
                </a>
                <a
                  href={`mailto:${selectedQuote.customer_email}?subject=${encodeURIComponent(
                    `Your Pressure Washing Quote - ${company.company_name}`
                  )}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition"
                >
                  Email
                </a>
                <button
                  type="button"
                  onClick={() => handleGeneratePDF(selectedQuote)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
                >
                  Download PDF Quote
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteQuote(selectedQuote.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-300 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}