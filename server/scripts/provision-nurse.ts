// Usage: npm run nurse:provision -- +97699112233 "Б.Номин"
// Creates (or confirms) a NURSE account that signs in with phone + OTP.
import "dotenv/config";
import prisma from "../src/db/db.config";
import { provisionNurse, provisionSchema } from "../src/services/nurseProvision";

const [phone, name] = process.argv.slice(2);
const parsed = provisionSchema.safeParse({ phone, name });
if (!parsed.success) {
  console.error('Usage: npm run nurse:provision -- +976XXXXXXXX "Нэр"');
  process.exit(2);
}
void provisionNurse(prisma, parsed.data)
  .then((result) => {
    console.log(JSON.stringify(result));
    if (result.status === "refused") process.exitCode = 1;
  })
  .catch(() => {
    console.error("Provisioning failed");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
