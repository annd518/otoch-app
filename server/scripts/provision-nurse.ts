// Usage:
//   npm run nurse:provision -- +97699112233 "Б.Номин"
//   npm run nurse:provision -- +97699112233 "Б.Номин" --verified --license 10387 \
//       --expires 2028-05-31 --skills INJ,IV,WOUND --zones Z1,Z2
// Creates (or updates) a NURSE account that signs in with phone + OTP. Without
// --verified the nurse stays PENDING and is never offered orders.
import "dotenv/config";
import prisma from "../src/db/db.config";
import { provisionNurse, type ProvisionInput } from "../src/services/nurseProvision";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const positional = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
const [phone, name] = positional;
const expires = flag("expires");
const input: ProvisionInput = {
  phone,
  name,
  ...(args.includes("--verified") && { verified: true }),
  ...(flag("license") && { licenseNo: flag("license") }),
  ...(expires && { licenseExpiresAt: new Date(`${expires}T23:59:59+08:00`) }),
  ...(flag("skills") && { skillTags: flag("skills")!.split(",") as ProvisionInput["skillTags"] }),
  ...(flag("zones") && { zoneIds: flag("zones")!.split(",") }),
};
void provisionNurse(prisma, input)
  .then((result) => {
    console.log(JSON.stringify(result));
    if (result.status === "refused") process.exitCode = 1;
  })
  .catch((e) => {
    console.error(e?.name === "ZodError" ? "Буруу оролт: " + e.issues.map((i: { message: string }) => i.message).join("; ") : "Provisioning failed");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
