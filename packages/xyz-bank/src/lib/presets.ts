/* Markets and industries. A market sets money, names, ID types and local
   detail; an industry sets the words for the product and which scenarios
   lead. Sense is global: Nigeria is one market among several. */

export type MarketId = 'gb' | 'ng' | 'ke' | 'us' | 'in' | 'za' | 'eu';
export type IndustryId = 'bank' | 'lender' | 'wallet' | 'gig' | 'marketplace' | 'gaming';

export interface Market {
  id: MarketId;
  label: string;
  currency: string;
  locale: string;
  city: string;
  idType: string;
  idSample: string;
  accountLine: string;
  phone: string;
  /** People in scripted stories: genuine customer, victim, attacker alias, payees. */
  people: { genuine: string; victim: string; alias: string; payees: [string, string, string] };
  merchants: [string, string, string];
  employer: string;
  /** Typical amounts, in whole currency units, scaled for the market. */
  scale: number;
}

export const MARKETS: Record<MarketId, Market> = {
  gb: {
    id: 'gb', label: 'United Kingdom', currency: 'GBP', locale: 'en-GB', city: 'London',
    idType: 'passport', idSample: '533 401 882', accountLine: 'Sort code 04-00-75 · 1938 2244', phone: '+44 7700 900 412',
    people: { genuine: 'Amara Okafor', victim: 'Daniel Mensah', alias: 'Chidi Eze', payees: ['R. Okoro', 'K. Lewis', 'P. Arora'] },
    merchants: ['Tesco Express', 'TfL', 'Pret A Manger'], employer: 'Kestrel Ltd', scale: 1,
  },
  ng: {
    id: 'ng', label: 'Nigeria', currency: 'NGN', locale: 'en-NG', city: 'Lagos',
    idType: 'NIN', idSample: '7421 0093 518', accountLine: 'XYZ Bank · 0123 4567 89', phone: '+234 803 555 0142',
    people: { genuine: 'Amara Okafor', victim: 'Tunde Bakare', alias: 'Chidi Eze', payees: ['R. Okoro', 'K. Ibrahim', 'F. Adeyemi'] },
    merchants: ['Shoprite Lekki', 'Bolt', 'Chicken Republic'], employer: 'Kestrel Ltd', scale: 1500,
  },
  ke: {
    id: 'ke', label: 'Kenya', currency: 'KES', locale: 'en-KE', city: 'Nairobi',
    idType: 'national ID', idSample: '2934 8812', accountLine: 'XYZ Bank · 0112 004 5521', phone: '+254 712 555 019',
    people: { genuine: 'Wanjiru Kamau', victim: 'Brian Otieno', alias: 'Kevin Mwangi', payees: ['J. Njoroge', 'A. Hassan', 'M. Wekesa'] },
    merchants: ['Naivas', 'Uber', 'Java House'], employer: 'Kestrel Ltd', scale: 160,
  },
  us: {
    id: 'us', label: 'United States', currency: 'USD', locale: 'en-US', city: 'Austin',
    idType: "driver's license", idSample: 'TX 48 221 903', accountLine: 'Routing 021000021 · ••4410', phone: '+1 512 555 0147',
    people: { genuine: 'Maya Torres', victim: 'Daniel Brooks', alias: 'Chris Hale', payees: ['R. Ortiz', 'K. Lewis', 'P. Shah'] },
    merchants: ['Whole Foods', 'Uber', 'Starbucks'], employer: 'Kestrel Inc', scale: 1.3,
  },
  in: {
    id: 'in', label: 'India', currency: 'INR', locale: 'en-IN', city: 'Bengaluru',
    idType: 'PAN', idSample: 'ABCPK 4821 L', accountLine: 'IFSC XYZB0001042 · ••7731', phone: '+91 98450 55012',
    people: { genuine: 'Ananya Rao', victim: 'Rahul Mehta', alias: 'Vikram Shetty', payees: ['S. Iyer', 'K. Das', 'P. Nair'] },
    merchants: ['BigBasket', 'Ola', 'Third Wave Coffee'], employer: 'Kestrel Pvt Ltd', scale: 105,
  },
  za: {
    id: 'za', label: 'South Africa', currency: 'ZAR', locale: 'en-ZA', city: 'Johannesburg',
    idType: 'SA ID number', idSample: '900214 5123 084', accountLine: 'Branch 250655 · ••3381', phone: '+27 82 555 0193',
    people: { genuine: 'Thandi Nkosi', victim: 'Sipho Dlamini', alias: 'Lebo Mokoena', payees: ['J. van Wyk', 'A. Naidoo', 'M. Botha'] },
    merchants: ['Woolworths Food', 'Uber', 'Vida e Caffè'], employer: 'Kestrel (Pty) Ltd', scale: 23,
  },
  eu: {
    id: 'eu', label: 'Europe', currency: 'EUR', locale: 'en-IE', city: 'Dublin',
    idType: 'national ID card', idSample: 'IE 8823 1190', accountLine: 'IBAN IE29 XYZB ••• 4410', phone: '+353 87 555 0148',
    people: { genuine: 'Sofia Romano', victim: 'Lukas Weber', alias: 'Marco Bianchi', payees: ['J. Murphy', 'A. Dubois', 'P. Novak'] },
    merchants: ['Lidl', 'Free Now', 'Insomnia Coffee'], employer: 'Kestrel Ltd', scale: 1.15,
  },
};

export interface Industry {
  id: IndustryId;
  label: string;
  short: string;
  /** What the person opens: "an account", "a loan", ... */
  product: string;
  productNoun: string;
  /** The money-out moment for account protection. */
  payoutVerb: string;
  heroLine: string;
  signupCta: string;
  /** Scenario ids in the order this audience should see them. */
  leads: string[];
}

export const INDUSTRIES: Record<IndustryId, Industry> = {
  bank: {
    id: 'bank', label: 'Bank or neobank', short: 'Banks', product: 'an account', productNoun: 'account', payoutVerb: 'Send money',
    heroLine: 'Money that knows it’s you.', signupCta: 'Open an account',
    leads: ['face-swap-stolen-id', 'recruited-mule', 'sim-swap-new-phone', 'new-payee', 'same-face-new-name'],
  },
  lender: {
    id: 'lender', label: 'Lender', short: 'Lenders', product: 'a loan', productNoun: 'loan', payoutVerb: 'Get my loan',
    heroLine: 'Credit for real people, in minutes.', signupCta: 'Apply for a loan',
    leads: ['same-face-new-name', 'face-swap-stolen-id', 'real-record-wrong-face', 'network-match', 'grey-case'],
  },
  wallet: {
    id: 'wallet', label: 'Wallet or payments', short: 'Wallets', product: 'a wallet', productNoun: 'wallet', payoutVerb: 'Send money',
    heroLine: 'Pay anyone. Only you can.', signupCta: 'Create my wallet',
    leads: ['new-payee', 'mule-ring', 'recruited-mule', 'sim-swap-new-phone', 'face-swap-stolen-id'],
  },
  gig: {
    id: 'gig', label: 'Mobility or gig', short: 'Gig', product: 'a driver account', productNoun: 'driver account', payoutVerb: 'Cash out earnings',
    heroLine: 'Drive, earn, get paid today.', signupCta: 'Sign up to drive',
    leads: ['rented-account', 'same-face-new-name', 'face-swap-stolen-id', 'new-payee', 'bot-farm'],
  },
  marketplace: {
    id: 'marketplace', label: 'Marketplace', short: 'Marketplaces', product: 'a seller account', productNoun: 'seller account', payoutVerb: 'Withdraw sales',
    heroLine: 'Sell to people who trust you.', signupCta: 'Start selling',
    leads: ['bot-farm', 'network-match', 'same-face-new-name', 'undeclared-automation', 'new-payee'],
  },
  gaming: {
    id: 'gaming', label: 'Gaming or digital assets', short: 'Gaming', product: 'a player account', productNoun: 'player account', payoutVerb: 'Withdraw winnings',
    heroLine: 'One player. One account. Real wins.', signupCta: 'Create my account',
    leads: ['same-face-new-name', 'bot-farm', 'dormant-account', 'new-payee', 'undeclared-automation'],
  },
};

export function formatMoney(amount: number, market: Market, opts: { sign?: boolean; cents?: boolean } = {}): string {
  const fmt = new Intl.NumberFormat(market.locale, {
    style: 'currency', currency: market.currency,
    minimumFractionDigits: opts.cents ? 2 : 0, maximumFractionDigits: opts.cents ? 2 : 0,
  });
  const s = fmt.format(Math.abs(amount));
  if (!opts.sign) return amount < 0 ? `−${s}` : s;
  return amount < 0 ? `−${s}` : `+${s}`;
}

/** Scale a base amount (written in GBP-like units) to the market and round it nicely. */
export function scaleAmount(base: number, market: Market): number {
  const v = base * market.scale;
  if (v >= 100000) return Math.round(v / 10000) * 10000;
  if (v >= 10000) return Math.round(v / 1000) * 1000;
  if (v >= 1000) return Math.round(v / 100) * 100;
  if (v >= 100) return Math.round(v / 10) * 10;
  return Math.round(v * 100) / 100;
}
