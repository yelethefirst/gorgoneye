// Curated list of common brand eTLD+1 values targeted by phishing.
// Stored here (not as JSON in public/) so it is statically bundled, type-checked,
// and importable by tests. Expand or override via settings in later milestones.

export interface ProtectedBrand {
  brand: string;
  domains: string[]; // canonical eTLD+1 values
}

export const PROTECTED_BRANDS: readonly ProtectedBrand[] = [
  { brand: "Google", domains: ["google.com", "youtube.com", "gmail.com"] },
  {
    brand: "Microsoft",
    domains: ["microsoft.com", "office.com", "outlook.com", "live.com", "azure.com"],
  },
  { brand: "Apple", domains: ["apple.com", "icloud.com"] },
  { brand: "Amazon", domains: ["amazon.com", "aws.amazon.com"] },
  { brand: "PayPal", domains: ["paypal.com"] },
  { brand: "Meta", domains: ["facebook.com", "instagram.com", "whatsapp.com", "meta.com"] },
  { brand: "LinkedIn", domains: ["linkedin.com"] },
  { brand: "X / Twitter", domains: ["twitter.com", "x.com"] },
  { brand: "Netflix", domains: ["netflix.com"] },
  { brand: "Dropbox", domains: ["dropbox.com"] },
  { brand: "DocuSign", domains: ["docusign.com"] },
  { brand: "GitHub", domains: ["github.com"] },
  { brand: "GitLab", domains: ["gitlab.com"] },
  { brand: "Slack", domains: ["slack.com"] },
  { brand: "Zoom", domains: ["zoom.us"] },
  { brand: "Adobe", domains: ["adobe.com"] },
  { brand: "Shopify", domains: ["shopify.com"] },
  { brand: "Stripe", domains: ["stripe.com"] },
  { brand: "Walmart", domains: ["walmart.com"] },
  { brand: "Target", domains: ["target.com"] },
  { brand: "eBay", domains: ["ebay.com"] },
  { brand: "Spotify", domains: ["spotify.com"] },
  { brand: "FedEx", domains: ["fedex.com"] },
  { brand: "UPS", domains: ["ups.com"] },
  { brand: "USPS", domains: ["usps.com"] },
  { brand: "DHL", domains: ["dhl.com"] },
  { brand: "Bank of America", domains: ["bankofamerica.com", "bofa.com"] },
  { brand: "Chase", domains: ["chase.com"] },
  { brand: "Wells Fargo", domains: ["wellsfargo.com"] },
  { brand: "Citi", domains: ["citi.com", "citibank.com"] },
  { brand: "Capital One", domains: ["capitalone.com"] },
  { brand: "American Express", domains: ["americanexpress.com", "amex.com"] },
  { brand: "Discover", domains: ["discover.com"] },
];
