import type { Company, Quote } from "./supabase";

const MOCK_COMPANY_ID = "11111111-1111-1111-1111-111111111111";

const MOCK_COMPANIES: Company[] = [
  {
    id: MOCK_COMPANY_ID,
    company_name: "Bright Wash Pro",
    email: "hello@brightwashpro.com",
    phone: "(512) 555-0100",
    website: "https://brightwashpro.com",
    address: "Austin, TX",
    min_service_fee: 150,
    house_wash_rate_per_sqft: 0.15,
    driveway_small_fee: 99,
    driveway_medium_fee: 159,
    driveway_large_fee: 249,
    roof_cleaning_addon: 40,
    gutter_cleaning_addon: 25,
    created_at: "2026-07-01T12:00:00.000Z",
  },
];

const MOCK_QUOTES: Quote[] = [
  {
    id: "quote-0001",
    company_id: MOCK_COMPANY_ID,
    customer_name: "Sarah Johnson",
    customer_email: "sarah.j@example.com",
    customer_phone: "(512) 555-0142",
    service_address: "2201 Lakewood Dr, Austin, TX 78703",
    zip_code: "78703",
    service_type: "Both House & Driveway",
    property_size: 2800,
    driveway_size: "medium",
    addons: ["roof"],
    line_items: [
      { label: "House Wash", amount: 420 },
      { label: "Driveway — Medium (2–3 cars)", amount: 159 },
      { label: "Roof Cleaning", amount: 40 },
    ],
    subtotal: 619,
    total: 619,
    quote_type: "instant",
    status: "new",
    preferred_date: "2026-08-12",
    preferred_time_window: "morning",
    pricing_snapshot: {
      config: MOCK_COMPANIES[0],
      generatedAt: "2026-08-09T15:30:00.000Z",
    },
    created_at: "2026-08-09T15:30:00.000Z",
    updated_at: null,
  },
  {
    id: "quote-0002",
    company_id: MOCK_COMPANY_ID,
    customer_name: "Mike Torres",
    customer_email: "mike.t@example.com",
    customer_phone: "(737) 555-0198",
    service_address: "908 Pecan Creek Cir, Round Rock, TX 78681",
    zip_code: "78681",
    service_type: "House Wash Only",
    property_size: null,
    driveway_size: null,
    addons: [],
    line_items: [],
    subtotal: 0,
    total: 0,
    quote_type: "custom",
    status: "new",
    preferred_date: null,
    preferred_time_window: null,
    pricing_snapshot: {
      config: MOCK_COMPANIES[0],
      generatedAt: "2026-08-08T09:12:00.000Z",
    },
    created_at: "2026-08-08T09:12:00.000Z",
    updated_at: null,
  },
];

let companiesStore: Company[] = [...MOCK_COMPANIES];
let quotesStore: Quote[] = [...MOCK_QUOTES];

type Result = { data: any; error: { message: string } | null };

class MockBuilder {
  private filters: { field: string; value: unknown }[] = [];
  private orderField: string | null = null;
  private orderAscending = true;
  private isSingle = false;
  private insertData: unknown = null;
  private updateData: unknown = null;
  private isDelete = false;

  constructor(private table: "companies" | "quotes") {}

  select(_columns = "*") {
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push({ field, value });
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orderField = field;
    this.orderAscending = options?.ascending ?? true;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  insert(data: unknown) {
    this.insertData = data;
    return this;
  }

  update(data: unknown) {
    this.updateData = data;
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }

  then(resolve: (value: Result) => void, _reject: (reason: unknown) => void) {
    const result = this.apply();
    resolve(result);
    return Promise.resolve();
  }

  private apply(): Result {
    if (this.isDelete) {
      if (this.table === "quotes") {
        quotesStore = quotesStore.filter((q) => !this.matches(q));
      }
      return { data: null, error: null };
    }

    if (this.updateData) {
      const updates = this.updateData as Partial<Company> | Partial<Quote>;
      if (this.table === "companies") {
        companiesStore = companiesStore.map((c) =>
          this.matches(c) ? { ...c, ...updates } : c
        );
      }
      if (this.table === "quotes") {
        quotesStore = quotesStore.map((q) =>
          this.matches(q)
            ? ({ ...q, ...updates, updated_at: new Date().toISOString() } as Quote)
            : q
        );
      }
      return { data: null, error: null };
    }

    if (this.insertData) {
      if (this.table === "quotes") {
        const insert = this.insertData as Partial<Quote>;
        const createdAt = new Date().toISOString();
        const record = {
          ...(insert as Quote),
          id: `quote-${Date.now()}`,
          created_at: createdAt,
          updated_at: null,
        };
        quotesStore = [record, ...quotesStore];
      }
      return { data: null, error: null };
    }

    const rows = (this.table === "companies"
      ? companiesStore
      : quotesStore) as Record<string, unknown>[];
    let results = rows.filter((row) => this.matches(row));

    if (this.orderField) {
      results = [...results].sort((a, b) => {
        const av = a[this.orderField!];
        const bv = b[this.orderField!];
        const cmp =
          av === bv
            ? 0
            : av === undefined || av === null
            ? 1
            : bv === undefined || bv === null
            ? -1
            : av < bv
            ? -1
            : 1;
        return this.orderAscending ? cmp : -cmp;
      });
    }

    if (this.isSingle) {
      if (results.length === 0) {
        return { data: null, error: { message: "No rows found." } };
      }
      return { data: results[0], error: null };
    }

    return { data: results, error: null };
  }

  private matches(row: Record<string, unknown>): boolean {
    return this.filters.every(({ field, value }) => row[field] === value);
  }
}

export function createMockSupabase() {
  return {
    from: (table: string) =>
      new MockBuilder(table === "companies" ? "companies" : "quotes"),
  };
}