type QuoteNotification = {
  companyName: string;
  companyEmail: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceAddress: string;
  serviceLabel: string;
  estimatedValue: number;
  preferredDate: string | null | undefined;
  preferredTimeWindow: string | null | undefined;
};

const EMAILS_ENABLED = process.env.EMAILS_ENABLED === "true";

function formatDate(value?: string | null): string {
  if (!value) return "Flexible";
  const parsed = new Date(value + "T00:00:00");
  if (isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}

/*
 * Transactional email scaffold.
 *
 * When a provider (Resend, SendGrid, Postmark) and EMAILS_ENABLED are
 * configured, these two messages should be delivered. Until then, they are
 * logged to the server console so the flow is verifiable end to end.
 */
export async function sendQuoteNotifications(data: QuoteNotification) {
  const now = new Date().toISOString();
  const preferredDate = formatDate(data.preferredDate);
  const timeLabel =
    data.preferredTimeWindow === "morning"
      ? "Morning"
      : data.preferredTimeWindow === "afternoon"
      ? "Afternoon"
      : "Flexible";

  const businessSubject = `New Quote Request — $${data.estimatedValue.toFixed(2)}`;
  const businessBody = [
    "New quote request received.",
    "",
    `Customer: ${data.customerName}`,
    `Phone: ${data.customerPhone}`,
    `Email: ${data.customerEmail}`,
    `Service: ${data.serviceLabel}`,
    `Estimated Value: $${data.estimatedValue.toFixed(2)}`,
    `Preferred Date: ${preferredDate}`,
    `Preferred Time: ${timeLabel}`,
    `Address: ${data.serviceAddress}`,
    "",
    "Open QuoteFlow to view and manage this request.",
  ].join("\n");

  const customerSubject = `Your ${data.companyName} Estimate`;
  const customerBody = [
    `Estimated Total: $${data.estimatedValue.toFixed(2)}`,
    `Preferred Date: ${preferredDate}`,
    `Preferred Time: ${timeLabel}`,
    "",
    "The business will review your request and confirm the service time.",
  ].join("\n");

  const emailPayload = [
    {
      to: data.companyEmail,
      subject: businessSubject,
      body: businessBody,
    },
    {
      to: data.customerEmail,
      subject: customerSubject,
      body: customerBody,
    },
  ];

  if (EMAILS_ENABLED) {
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // for (const message of emailPayload) await resend.emails.send({...});
  } else {
    // eslint-disable-next-line no-console
    console.log("[QuoteFlow notifications]", now, JSON.stringify(emailPayload, null, 2));
  }
}