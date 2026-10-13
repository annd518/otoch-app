# L1-1 шалгуур 6–10: staging, QPay sandbox, TestFlight, Google Play

> Бэлтгэсэн: 2026-10-13, branch `feat/release-infra`. L1-1 №1–5 (каталог, захиалга, red flag, upload, tracking)-аас **хамааралгүй** хэсгүүдийг энд бэлдсэн. №1–5-ийг өөр хөгжүүлэгч хийж байна.
> **Энэ баримтын алхмууд хараахан хийгдээгүй.** Аккаунт, төлбөр, credential ирсний дараа энэ дарааллаар явна. Төлбөртэй resource үүсгэх алхам бүрийг эзэмшигч тусад нь зөвшөөрнө.

## 0. Хамаарал ба одоогийн төлөв

```
7. HTTPS staging ─┬─> 6. QPay sandbox (callback-д HTTPS хаяг хэрэгтэй)
                  └─> 8. TestFlight, 9. Play internal (release build-д HTTPS API URL хэрэгтэй)
                                         └─> 10. Play closed testing
```

| # | Кодоор бэлэн (энэ PR) | Хүлээж буй (эзэмшигч) |
|---|---|---|
| 7 | `render.yaml` (Render, Сингапур), Dockerfile-д migration, `smoke-staging.mjs`, `storage-probe.cjs`, `TRUST_PROXY` засвар | Render аккаунт + төлбөр, Cloudflare R2, зардлын зөвшөөрөл |
| 6 | Adapter-ийг QPay v2-той тулгасан, `qpay-sandbox-check.ts`, provider-ийг 10 сек тутамд л шалгана | QPay merchant **sandbox** эрх (client ID, secret, `invoice_code`) |
| 8 | Тест дугаар (`OTP_TEST_ACCOUNTS`) Apple review-д | Apple Developer ($99/жил), App Store Connect, bundle ID, D-U-N-S (байгууллага бол) |
| 9 | Тест дугаар, EAS `staging` profile (store) | Google Play Developer ($25), package name, эхний AAB-ыг гараар upload |
| 10 | — | Тестерүүдийн жагсаалт, Google-ийн review |

**Нэвтрэлт:** v2 апп утасны дугаар болон SMS кодоор нэвтэрдэг. Staging, TestFlight, Play тестерүүд болон Apple review-ийн хүн SMS хүлээж авах боломжгүй. Тиймээс `OTP_TEST_ACCOUNTS`-д тогтмол кодтой тест дугаар бүртгэнэ. Код нь хариунд болон log-д гарахгүй, жагсаалтад байхгүй дугаарт хуучин дүрэм хэвээр (тест: `server/tests/otp-test-accounts.test.ts`). Кодуудыг нууц гэж үзэж, тестерүүдэд хувиар өгнө.

---

## 1. Эзэмшигчийн шийдвэр ба эрх (эхлээд)

| Юу | Хэзээ хэрэгтэй | Тэмдэглэл |
|---|---|---|
| Hosting: Render + Cloudflare R2 | 7 | Үнийг Render dashboard-аас шалгаж зөвшөөрнө (plan: `0.5c-512mb` web, `0.5c-1g` Postgres) |
| App identifier, жишээ нь `mn.otoch.app` | 8, 9 | Store-д нэг удаа бүртгэгдсэн бол **солих боломжгүй** |
| Apple Developer Program, байгууллагаар бол D-U-N-S | 8 | D-U-N-S авахад хэдэн өдрөөс хэдэн долоо хоног зарцуулагдана. **Эрт эхлэх** |
| Google Play Developer, байгууллагаар бол D-U-N-S | 9, 10 | |
| QPay merchant sandbox эрх | 6 | Баримтад нийтийн тест эрх **байхгүй** |
| Нууцлалын бодлогын URL | 8, 9 | Апп эрүүл мэндийн мэдээлэл боловсруулдаг. Хоёр store хоёулаа шаардана |
| Export compliance (`ITSAppUsesNonExemptEncryption`) | 8 | Зөвхөн HTTPS ашигладаг бол ихэвчлэн `false`. Шийдвэрийг эзэмшигч гаргана |
| Тест дугаар + код (`OTP_TEST_ACCOUNTS`) | 7–10 | Жишээ нь тестер бүрт нэг дугаар. Кодыг санамсаргүйгээр үүсгэнэ |

---

## 2. Staging (шалгуур 7): Render + Cloudflare R2

Загвар нь `docker-compose.staging-test.yml` болон `docs/l1-1-acceptance/README.md`-ийн "Migration ба staging дараалал"-тай ижил: `APP_ENV=staging-test`, `NODE_ENV=development`, SMS ба QPay mock, private S3. **Зөвхөн зохиомол өгөгдөл.**

### 2.1 Cloudflare R2 (private bucket)

1. R2 → **Create bucket**: `otoch-staging-uploads`. Location: Asia-Pacific (APAC) байвал сонгоно.
2. **Public access идэвхжүүлэхгүй.** `r2.dev` subdomain болон custom domain-ийг унтраалттай үлдээнэ.
3. R2 → **Manage API tokens** → *Object Read & Write*, **зөвхөн энэ bucket**-д. Гарсан Access Key ID, Secret, endpoint (`https://<account-id>.r2.cloudflarestorage.com`)-ийг дараагийн алхамд Render-д шууд оруулна. Чат, git, файлд бичихгүй.

### 2.2 Render

1. Render → **New → Blueprint** → `annd518/otoch-app`, branch `main` → `render.yaml`.
2. Үүсэх resource болон **үнийг** шалгаж, эзэмшигч зөвшөөрсний дараа **Apply** дарна. Сар бүрийн төлбөр эндээс эхэлнэ.
3. `sync: false` утгуудыг dashboard дээр бөглөнө:

   | Key | Утга |
   |---|---|
   | `PUBLIC_BASE_URL` | `https://otoch-staging-api.onrender.com` (эсвэл өөрийн домэйн) |
   | `CORS_ORIGINS` | Staff web-ийн origin (одоохондоо хоосон байж болно) |
   | `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | §2.1 |
   | `OTP_TEST_ACCOUNTS` | `+976XXXXXXXX:NNNNNN,...` |
   | `QPAY_*` | QPay эрх ирэх хүртэл хоосон (`QPAY_MODE=mock`) |

4. **Deploy.** Render image build хийнэ → `preDeployCommand` нь `prisma migrate deploy`-оор зөвхөн commit хийсэн migration-уудыг ажиллуулна → health check (`/api/health`).
   `db push`, `migrate reset`, `migrate resolve` **хэрэглэхгүй**.
5. **DB encoding шалгах.** Render Postgres-ийн *Connect → PSQL command*-оор:
   ```sql
   SHOW server_encoding;   -- UTF8 байх ёстой
   ```

### 2.3 Зохиомол өгөгдөл

Runtime image-д `tsx` болон seed script байхгүй. Seed-ийг source-той орчноос нэг удаа ажиллуулна:

1. Render Postgres → *Access Control*-д өөрийн IP-г **түр** нэмнэ.
2. Локал PowerShell. Утгыг командын мөрөнд бичихгүй, `server\.env`-д ч хадгалахгүй:
   ```powershell
   cd D:\hulgai\Pariwar-Care-\server
   $env:DATABASE_URL = Read-Host "Render External Database URL"
   $env:NODE_ENV = "production"; $env:ALLOW_FIXTURE_DATA = "true"
   npx.cmd prisma db seed
   Remove-Item Env:DATABASE_URL, Env:NODE_ENV, Env:ALLOW_FIXTURE_DATA
   ```
   `NODE_ENV=production` үед seed **demo хэрэглэгч үүсгэхгүй** (нийтэд мэдэгдэж буй `Demo123!` нууц үгтэй ADMIN үүсэхгүй), зөвхөн fixture үүсгэнэ.
3. Батлагдсан контентын import: `npm run content:import`. Dry-run → review → apply (`docs/l1-1-acceptance/README.md`).
4. IP-г allow list-ээс **хасна**.

### 2.4 Smoke тест

```powershell
cd D:\hulgai\Pariwar-Care-\server
$env:SMOKE_PHONE = "+976XXXXXXXX"; $env:SMOKE_CODE = Read-Host "test code"
node scripts/smoke-staging.mjs https://otoch-staging-api.onrender.com
```

Шалгах зүйлс: HTTPS сертификат, health, token-гүй 401, буруу callback secret 404, тест дугаараар нэвтрэх, каталогийн монгол бичвэр (UTF8), захиалгын жагсаалт (migration). Бүгд давбал `PASSED: 6/6`. Нэг ажиллахад нэг OTP код үүснэ (дугаар бүрт минутад 1).

**Private bucket ба restart-ийн дараах хадгалалт.** Render → service → **Shell**:
```sh
node scripts/storage-probe.cjs put        # бичээд буцааж уншина; нэвтрэлтгүй GET 4xx байх ёстой
# Render dashboard → Manual Deploy (эсвэл Restart), дараа нь:
node scripts/storage-probe.cjs get <key>  # ok: true бол restart-ийн дараа хадгалагдсан
node scripts/storage-probe.cjs delete <key>
```

### 2.5 Rollback

Render → service → **Rollbacks**-оос өмнөх deploy-г сонгоно. Migration-ууд зөвхөн нэмэлт тул хуучин код шинэ хүснэгтийг үл тоож ажиллана. DB-г backup-аас сэргээх нь тусдаа шийдвэр (өгөгдөл алдагдах эрсдэл).

---

## 3. QPay sandbox (шалгуур 6)

**Төлөв:** adapter нь QPay v2-ийн нийтийн баримттай таарч байна: `POST /v2/auth/token` (Basic), `POST /v2/invoice` (`invoice_code`, `sender_invoice_no`, `invoice_receiver_code`, `invoice_description`, `amount`, `callback_url` → `invoice_id`, `qr_text`, `qr_image`, `urls`), `POST /v2/payment/check` (`object_type: INVOICE`). Sandbox: `https://merchant-sandbox.qpay.mn`. **Бодит sandbox-оор хараахан шалгаагүй.**

1. **QPay-ээс sandbox эрх авна:** client ID, client secret, `invoice_code`.
2. **Локал холболтын шалгалт.** Эрхийг зөвхөн тухайн PowerShell цонхны орчинд оруулна:
   ```powershell
   cd D:\hulgai\Pariwar-Care-\server
   $env:QPAY_MODE = "sandbox"; $env:QPAY_BASE_URL = "https://merchant-sandbox.qpay.mn"
   $env:QPAY_USERNAME = Read-Host "client id"; $env:QPAY_PASSWORD = Read-Host "client secret"; $env:QPAY_INVOICE_CODE = Read-Host "invoice code"
   npx.cmd tsx scripts/qpay-sandbox-check.ts
   ```
   Хүлээгдэх үр дүн: `createInvoice ok: true`, `hasQrText: true`, банкны deeplink-ийн нэрс, `check paid: false`. Script нь зөвхөн sandbox хаягтай ажиллана, нууц утгыг хэвлэхгүй.
3. **Staging дээр:** Render env-д `QPAY_MODE=sandbox`, `QPAY_BASE_URL`, `QPAY_USERNAME`, `QPAY_PASSWORD`, `QPAY_INVOICE_CODE` оруулж deploy хийнэ. Callback хаяг автоматаар `PUBLIC_BASE_URL/api/payments/qpay/callback/<QPAY_CALLBACK_SECRET>`.
4. **Шалгах сценарууд** (апп эсвэл API-аар):

   | Сценари | Хүлээгдэх үр дүн |
   |---|---|
   | Invoice → sandbox-оор төлөх → callback → PAID | `payment.status = PAID`, `paidAt`, захиалга `PAID` |
   | Callback-ийг дахин илгээх (давхар) | Нэг л `PAID`, нэг л event |
   | Буруу дүн (sandbox зөвшөөрвөл) | `PAID` болохгүй, `failureCode: AMOUNT_MISMATCH` |
   | Хугацаа дуусах | `EXPIRED`, захиалга `DRAFT` |
   | Timeout ба давтан хүсэлт | Давхар invoice үүсэхгүй (api §7.1.1) |

5. Үр дүнг (огноо, commit, invoice id, screenshot) `docs/l1-1-acceptance/acceptance.md`-д бичнэ. Mock-ийн үр дүнг sandbox гэж бичихгүй.

**Polling:** QPay `payment/check`-ийг хэт ойр poll хийхгүй байхыг зөвлөдөг. Server нь бодит provider-ийг нэг төлбөрт **10 сек тутамд** л шалгана (mock-д 2 сек), callback ирвэл шууд шалгана.

---

## 4. iOS TestFlight (шалгуур 8)

Урьдчилсан нөхцөл: §2 staging ажиллаж байх, Apple Developer аккаунт, bundle ID баталгаажсан байх.

1. `App/app.json`-д (identifier батлагдсаны дараа):
   ```json
   "ios": { "supportsTablet": true, "bundleIdentifier": "mn.otoch.app",
            "infoPlist": { "ITSAppUsesNonExemptEncryption": false } }
   ```
   `ITSAppUsesNonExemptEncryption`-ийн утгыг эзэмшигч баталгаажуулна.
2. EAS environment `preview`-д: `EXPO_PUBLIC_API_URL=https://otoch-staging-api.onrender.com`, `EXPO_PUBLIC_APP_ENV=staging-test`. Release build HTTPS URL-гүйгээр ажиллахгүй (`App/utils/apiConfig.ts`).
3. App Store Connect → **My Apps → +** → нэр "ОТОЧ", bundle ID, SKU.
4. ```powershell
   cd D:\hulgai\Pariwar-Care-\App
   eas build --platform ios --profile staging
   eas submit --platform ios --latest
   ```
   Apple ID болон 2FA-аар эзэмшигч өөрөө нэвтэрнэ. Distribution certificate болон profile-ийг EAS үүсгэнэ.
5. App Store Connect → TestFlight → **Internal Testing** group → тестерүүд (App Store Connect хэрэглэгчид, review шаардлагагүй).
   **External testing** нь Beta App Review шаардана. Тэнд нэвтрэх тест дугаар + кодыг "Sign-in information" хэсэгт өгнө.
6. **App Store-д гаргахаас өмнө** (TestFlight-д биш):
   - Апп дотроос аккаунт устгах товч. API `POST /api/client/account/deletion-request` бэлэн, UI олдсонгүй.
   - App Privacy маягт.
   - Нууцлалын бодлогын URL.

## 5. Google Play internal testing (шалгуур 9)

1. `App/app.json`-д: `"android": { "package": "mn.otoch.app", ... }`. Identifier батлагдсаны дараа.
2. Play Console → **Create app** → нэр, хэл (Монгол), апп/тоглоом биш, үнэгүй.
3. ```powershell
   cd D:\hulgai\Pariwar-Care-\App
   eas build --platform android --profile staging   # .aab, store distribution
   ```
4. **Эхний AAB-ыг Play Console-д гараар upload** хийнэ: Testing → Internal testing → Create release. Google-ийн дүрмээр анхны upload API-аар хийгдэхгүй. Дараагийн хувилбаруудыг `eas submit -p android` (service account JSON) ашиглаж болно.
5. Internal testers: и-мэйл жагсаалт (100 хүртэл) → opt-in холбоосыг тестерүүдэд илгээнэ.
6. Шаардлагатай маягтууд: App content → Privacy policy, Data safety (эрүүл мэнд, утасны дугаар, зураг), Content rating, Target audience, App access (тест дугаар + код).

## 6. Google Play closed testing (шалгуур 10)

1. Testing → **Closed testing** → track үүсгэнэ → тестерийн жагсаалт эсвэл Google Group.
2. Internal-д шалгасан release-ийг closed track руу promote хийнэ → **Google review** (хэдэн өдөр).
3. Хувийн (personal) developer аккаунтын хувьд production руу гарахаас өмнө closed testing-д тодорхой тооны тестер болон хугацаа шаардах дүрэм бий. Байгууллагын аккаунтад өөр. **Play Console-ийн одоогийн нөхцөлийг шалгана.**

---

## 7. Энэ PR-ийн шалгалт

| Шалгалт | Үр дүн |
|---|---|
| Server `tsc`, бүх тест (түр UTF8 DB) | PR тайлбарт |
| `smoke-staging.mjs` түр server-ийн эсрэг (`SMOKE_ALLOW_HTTP=1`) | 6/6 PASS. Тест дугааргүй үед FAILED (зөв) |
| `storage-probe.cjs` (memory driver) | put / read-after-write OK. Storage-гүй үед алдаа |
| `render.yaml` parse | 1 DB, 1 web service, 23 env, нууц утга файлд байхгүй |
| Docker image build | **Шалгаагүй.** Энэ компьютерийн Docker daemon ажиллахгүй. Render-ийн эхний build нь анхны бодит шалгалт болно |
| Render, R2, QPay sandbox, TestFlight, Play | **Хийгдээгүй** (аккаунт, эрх байхгүй) |
