import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { LegalPage } from "../LegalPage";

export const metadata: Metadata = {
  title: "Нууцлалын бодлого · ОТОЧ",
  description: "ОТОЧ апп таны хувийн мэдээллийг хэрхэн цуглуулж, ашиглаж, хамгаалдаг тухай",
};

// Read at build time: content/privacy-policy.md is the single source.
export default async function PrivacyPage() {
  const markdown = await readFile(
    path.join(process.cwd(), "content", "privacy-policy.md"),
    "utf8",
  );
  // The first heading keeps "(ТӨСӨЛ)" until a lawyer approves the text.
  const draft = /^#\s.*ТӨСӨЛ/m.test(markdown);
  return <LegalPage markdown={markdown} draft={draft} />;
}
