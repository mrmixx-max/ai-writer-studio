// DirectSalesVault (WP 75.2)
//
// Verwaltet digitale Ex-Libris-Wasserzeichen, Lizenz-Zertifikate und
// Direktvertriebs-Metadaten. Deterministisch: FNV-1a + mulberry32.
// Keine Node-Module.

export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ein Ex-Libris-Wasserzeichen. */
export interface ExLibrisWatermark {
  ownerName: string;
  transactionId: string;
  timestamp: string;
  signature: string;
}

/** Ein Lizenz-Zertifikat. */
export interface LicenseCertificate {
  id: string;
  title: string;
  owner: string;
  issueDate: string;
  edition: string;
  serialNumber: string;
  authenticityHash: string;
}

/** Ein Direktvertriebs-Produkt. */
export interface DirectSalesProduct {
  id: string;
  title: string;
  format: "epub" | "pdf" | "mobi";
  price: number;
  currency: string;
  watermark: ExLibrisWatermark;
  license: LicenseCertificate;
}

/** Erstellt ein Ex-Libris-Wasserzeichen. */
export function createWatermark(
  ownerName: string,
  transactionId: string,
): ExLibrisWatermark {
  const timestamp = "1970-01-01T00:00:00.000Z";
  const sigInput = `${ownerName}:${transactionId}:${timestamp}`;
  const sigHash = hashString(sigInput);
  const signature = `AIWS-${sigHash.toString(16).padStart(8, "0").toUpperCase()}`;

  return { ownerName, transactionId, timestamp, signature };
}

/** Erstellt ein Lizenz-Zertifikat. */
export function createLicenseCertificate(
  title: string,
  owner: string,
  edition: string,
): LicenseCertificate {
  const id = `LIC-${hashString(title + owner).toString(16).padStart(8, "0").toUpperCase()}`;
  const issueDate = "1970-01-01T00:00:00.000Z";
  const serialNumber = `SN-${(hashString(title + owner + edition) % 1000000).toString().padStart(6, "0")}`;
  const authInput = `${id}:${title}:${owner}:${edition}:${serialNumber}`;
  const authenticityHash = `AIWS-${hashString(authInput).toString(16).padStart(16, "0").toUpperCase()}`;

  return { id, title, owner, issueDate, edition, serialNumber, authenticityHash };
}

/** Erstellt ein Direktvertriebs-Produkt. */
export function createProduct(
  title: string,
  format: "epub" | "pdf" | "mobi",
  price: number,
  ownerName: string,
  transactionId: string,
  edition: string = "Standard",
): DirectSalesProduct {
  const watermark = createWatermark(ownerName, transactionId);
  const license = createLicenseCertificate(title, ownerName, edition);

  return {
    id: `PRD-${hashString(title + ownerName).toString(16).padStart(8, "0").toUpperCase()}`,
    title,
    format,
    price,
    currency: "EUR",
    watermark,
    license,
  };
}

/** Verifiziert die Authentizität eines Wasserzeichens. */
export function verifyWatermark(watermark: ExLibrisWatermark): boolean {
  const sigInput = `${watermark.ownerName}:${watermark.transactionId}:${watermark.timestamp}`;
  const expected = `AIWS-${hashString(sigInput).toString(16).padStart(8, "0").toUpperCase()}`;
  return watermark.signature === expected;
}

/** Verifiziert die Authentizität eines Zertifikats. */
export function verifyLicense(license: LicenseCertificate): boolean {
  const authInput = `${license.id}:${license.title}:${license.owner}:${license.edition}:${license.serialNumber}`;
  const expected = `AIWS-${hashString(authInput).toString(16).padStart(16, "0").toUpperCase()}`;
  return license.authenticityHash === expected;
}

/** Generiert ein Ex-Libris-Frontispiz als SVG. */
export function generateExLibrisFrontispiz(ownerName: string): string {
  const escaped = ownerName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">
  <rect width="400" height="200" fill="var(--bg)" stroke="var(--border)" stroke-width="2"/>
  <rect x="10" y="10" width="380" height="180" fill="none" stroke="var(--accent)" stroke-width="1" stroke-dasharray="4 2"/>
  <text x="200" y="80" text-anchor="middle" fill="var(--fg)" font-family="serif" font-size="14" font-style="italic">Dieses Exemplar gehört</text>
  <text x="200" y="120" text-anchor="middle" fill="var(--accent)" font-family="serif" font-size="20" font-weight="bold">${escaped}</text>
  <text x="200" y="160" text-anchor="middle" fill="var(--muted)" font-family="serif" font-size="10">AI Writer Studio — Ex-Libris</text>
</svg>`;
}

/** Formatiert ein Produkt als Text. */
export function formatProduct(product: DirectSalesProduct): string {
  const lines: string[] = [];
  lines.push(`=== DIREKTVERTRIEB-PRODUKT ===`);
  lines.push(`ID: ${product.id}`);
  lines.push(`Titel: ${product.title}`);
  lines.push(`Format: ${product.format}`);
  lines.push(`Preis: ${product.price} ${product.currency}`);
  lines.push("");
  lines.push(`WASSERZEICHEN:`);
  lines.push(`  Besitzer: ${product.watermark.ownerName}`);
  lines.push(`  Transaktion: ${product.watermark.transactionId}`);
  lines.push(`  Signatur: ${product.watermark.signature}`);
  lines.push(`  Verifiziert: ${verifyWatermark(product.watermark) ? "Ja" : "Nein"}`);
  lines.push("");
  lines.push(`LIZENZ:`);
  lines.push(`  ID: ${product.license.id}`);
  lines.push(`  Edition: ${product.license.edition}`);
  lines.push(`  Seriennummer: ${product.license.serialNumber}`);
  lines.push(`  Authentizität: ${product.license.authenticityHash}`);
  lines.push(`  Verifiziert: ${verifyLicense(product.license) ? "Ja" : "Nein"}`);
  return lines.join("\n");
}

/** Erstellt ein Beispiel-Produkt. */
export function createSampleProduct(): DirectSalesProduct {
  return createProduct(
    "Der Schatten des Vergessens",
    "epub",
    14.99,
    "Erik Gieske",
    "TXN-2026-001",
    "Sammler-Edition",
  );
}
