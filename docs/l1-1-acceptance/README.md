# L1-1 шаардлага 1–5: код ба acceptance

## Бодит төлөв

Энэ хэрэгжүүлэлт кодын түвшний ахиц юм. Эзэмшигч v2.0-ийн бүх агуулгыг чатад баталсан; [эх сурвалж/approval тайлан](source/approval.md), approved JSON багцууд бэлэн. Зорилтот DB-д publication, HTTPS staging, private bucket болон iPhone/Android acceptance хүлээгдэж байгаа тул 1–5 бүгд **🟡** хэвээр. QPay зөвхөн mock; sandbox биелсэн гэж үзэхгүй. Store upload энэ ажлын хүрээнд байхгүй.

| Шаардлага | Кодын нотолгоо | Ногоон болох үлдсэн gate |
|---|---|---|
| 1 Каталог | `serviceMetadata.ts`, `contentImport.ts`, `catalogController.ts`; DB metadata/approval/version, S01–S10/4 бүлэг | Бэлэн approved JSON-ийг зорилтот DB-д нийтлэх; staging дээр 10 үйлчилгээ, хоёр товшилтын review |
| 2 Захиалга | `orders.ts`, `paymentController.ts`, mobile `bookappointment.tsx`, consent catalogVersion/config guards | Батлагдсан бүс/slot; хоёр төхөөрөмжийн capacity/retry/resume acceptance |
| 3 Red flag | version бүхий 6 асуултын import, одоогийн RF guards; шинэ каталог editable draft-ийн CLEAR-г хүчингүй болгоно | Чатад батлагдсан questionnaire/catalog багцыг DB-д нийтлэх; төхөөрөмжийн 103 |
| 4 Зураг | `s3Storage.ts`, `attachmentController.ts`, `BlobCleanupJob`, `blobCleanup.ts` | Бодит private bucket upload/read/delete; HEIC, камер/permission; provider timeout acceptance |
| 5 Tracking | `/api/staff/orders`, `wclient/app/dashboard/orders/page.tsx`, mobile `orders/[id].tsx` | Staging staff→хоёр төхөөрөмжийн polling/foreground/offline acceptance |

Өмнөх UI тайлан: `docs/ui-v2/validation.md`. Шинэ storage/staff боломжуудын одоогийн эх сурвалж энэ баримт.

## Агуулгын баталгаажуулалт

`server/src/services/contentImport.ts`-ийн `publicationSchema` нь JSON-ийн гэрээ. Бүх төрөлд `kind`, `version`, `approvedBy`, `approvedAt` (ISO, ирээдүй биш) заавал. Эдгээр нь бүртгэлийн attestations; систем хүний эмнэлзүйн эрхийг автоматаар шалгахгүй. Import зөвхөн эрх бүхий deployment operator ажиллуулна. Дур мэдэн approval бөглөж fixture-г бодит гэж нийтлэхгүй.

- questionnaire: яг RF1–RF6, давхцахгүй code/эрэмбэ, 6 батлагдсан text. Нийтэлсэн version өөрчлөгдөхгүй; шинэ бичвэрт шинэ version.
- catalog: яг S01–S10, дөрвөн GROUP_A–D; үнэ бүхэл MNT, хугацаа, questionnaire version, эрэмбэ, DB metadata (`includes`, `preparation`, `nurseSupplies`, `exclusions`, `formConfig`). Config approved:true, category/group/referral тохирно; S03/S06 window120, бусад60. Questionnaire эхэлж нийтлэгдсэн байна.
- availability: батлагдсан zone bounds, slot эхлэл/төгсгөл/багтаамж; future ISO +08:00, нэг бүсийн цаг давхцахгүй. Өмнө нийтлэгдсэн slot-ийн хугацаа/capacity өөрчлөхгүй.

v2.0-ийн approved файлууд `server/content/approved/` дотор бэлэн; эх сурвалжийн тайлантай тулгана. Баталгаагүй жишээ файлыг approval:true болгон автоматаар хөрвүүлэх command байхгүй. `server/tests/content-import.test.ts` нь зөвхөн зохиомол тест payload-ийн жишээ; бодит import биш.

```sh
cd server
npm run content:import -- /secure/approved-questionnaire.json --dry-run
npm run content:import -- /secure/approved-questionnaire.json --apply
npm run content:import -- /secure/approved-catalog.json --dry-run
npm run content:import -- /secure/approved-catalog.json --apply
npm run content:import -- /secure/approved-availability.json --dry-run
npm run content:import -- /secure/approved-availability.json --apply
```

Default dry-run DB-д бичихгүй, schema/invariants/digest/count тайлан гаргана. DB dependency (questionnaire нийтлэгдсэн эсэх, slot conflict) apply transaction-д дахин шалгана; алдаа гарвал бүх publication rollback. Ижил version+digest replay no-op; өөр digest хориглоно. `ContentPublication.payload` нийтэлсэн snapshot хадгална. Fixture seed батлагдсан каталогийг overwrite хийхгүй.

Шинэ questionnaire-г ашиглахдаа каталогийн шинэ version дээр questionnaire reference-ийг шинэчилнэ. Каталог нийтлэхэд editable DRAFT version нэмэгдэж RF NOT_ANSWERED болно; BLOCKED draft дахин нээгдэхгүй. Хуучин quote version зөрнө; зөвшөөрөл шинэ catalogVersion-той байх ёстой.

## Staff API

JWT-ээс гадна одоогийн DB role/deletedAt шалгана. ADMIN/MEDICAL_ADMIN бүх order; NURSE зөвхөн өөрт томилогдсон order. CHILD staff API-д 403. Order эзэмшилгүй NURSE 404.

| Method/path | Role | Body / үр дүн |
|---|---|---|
| GET `/api/staff/orders?cursor=...` | staff | 50 мөр, nextCursor, environment; patientName, isMock |
| GET `/api/staff/orders/nurses` | ADMIN/MEDICAL_ADMIN | Зөвхөн нэр/id |
| GET `/api/staff/orders/:id` | scoped staff | order + timeline |
| POST `.../:id/assign` | ADMIN/MEDICAL_ADMIN | `{version,nurseId}` PAID/ASSIGNED → ASSIGNED; reassign ETA цэвэрлэнэ |
| POST `.../:id/eta` | assigned NURSE | `{version,eta}` future ISO эсвэл null; ASSIGNED/IN_PROGRESS |
| POST `.../:id/start` | assigned NURSE | `{version}` ASSIGNED → IN_PROGRESS |
| POST `.../:id/complete` | assigned NURSE | `{version}` IN_PROGRESS → COMPLETED |

Order row lock, expected version, status/event нэг transaction. Хуучирсан version409 VERSION_CONFLICT; буруу шилжилт409 INVALID_STATUS. Хуучин Visit-ээс төлөв автоматаар хуулахгүй. Web sidebar “Захиалгууд” `/dashboard/orders`. Mock order дээр бодит төлбөр биш гэж харуулна. Клиник тайлан автоматаар зохиохгүй.

## Private storage

`STORAGE_DRIVER=s3`; server secret store-д S3_BUCKET, S3_REGION; custom provider S3_ENDPOINT HTTPS, S3_FORCE_PATH_STYLE; explicit key/secret хос эсвэл provider IAM role. Mobile-д S3 credential/public URL өгөхгүй. Зөвхөн owner-authenticated attachment content API. Put нь public ACL тавихгүй; **bucket policy/public-access block-ийг provider дээр operator баталгаажуулах шаардлагатай**. Код bucket policy-г өөрчлөхгүй.

Timeout/unknown PUT болон DB rollback-д cleanup journal үлдэнэ; soft delete дараах blob failure дахин цэвэрлэгдэнэ. 10 мин grace, 100 job/batch. ACTIVE attachment-тай blob устгахгүй. Deployment cron/one-off worker-д:

```sh
cd server
npm run storage:cleanup
```

Нэг удаагийн runtime container-д tsx/scripts байхгүй тул cleanup/import командыг source/deployment tools орчноос ажиллуулна. Pending job count/oldest age, failure count monitoring хийж, backlog үед alert тавина. Cleanup job нь нийтэд endpoint биш. ≤10MB, JPEG/PNG bytes, global≤5 болон config≤2/3 хадгална. UI preview upload баталгаа биш.

## Migration ба staging дараалал

Одоо байгаа DB-д apply/seed/reset хийгдээгүй. `20261019000000_l1_acceptance` зөвхөн metadata/approval column болон publication/cleanup хүснэгт нэмнэ. Одоогийн өвчтөний missing мэдээллийг тааж бөглөхгүй.

1. Provider/account, HTTPS hostname, UTF8 PostgreSQL, private bucket, identifiers/signing/tester төхөөрөмж олгоно. Secret-ийг чат/git-д оруулахгүй.
2. Зорилтот DB-ийн backup: тохирох PostgreSQL `pg_dump --format=custom` ашиглан secret-managed connection-оор хадгална; restore rehearsal. Existing WIN1252 DB-г ашиглахгүй.
3. Docker image build болон health check; migrate target нэг удаа `prisma migrate deploy`. Reset/db push хэрэглэхгүй. Хуучин DB-д baseline шаардлагатай бол тусдаа review/зөвшөөрөл.
4. **Тусгаарласан synthetic-data staging**: NODE_ENV=development, APP_ENV=staging-test, QPAY_MODE=mock, STORAGE_DRIVER=s3, SMS_DRIVER=mock; public real customer ашиглахгүй. HTTPS reverse proxy, staff origin/CORS, secret store. Production mock/storage guard-ийг өөрчлөхгүй.
5. Батлагдсан import-уудыг dry-run→review→apply. Fixture test орчинд зөвхөн staging seed; privileged staff аккаунтыг private operator ажиллагаагаар үүсгэж, demo ADMIN production-д ашиглахгүй.
6. App EXPO_PUBLIC_APP_ENV=staging-test, EXPO_PUBLIC_API_URL=HTTPS staging, real API mode; wclient API URL staging. Identifier/signing батлагдмагц EAS `preview` internal build (APK / ad-hoc iOS); store profile/upload ажиллуулахгүй.
7. Private upload болон staff→mobile acceptance, negative scenarios, screenshot/device evidence.

Rollback: эхлээд traffic/worker зогсоож өмнөх image/config руу буцаана. Нэмэлт migration-ийг DROP хийхгүй. Агуулгын version rollback хийх бол хуучин батлагдсан snapshot-ийг **шинэ version** болгон review/import; booking consent/RF дахин шаардана. DB restore нь тусдаа зөвшөөрөлтэй, шинэ захиалга алдагдах эрсдэлийг үнэлнэ. Secret, real database, build signing файлыг commit хийхгүй.

## Acceptance нотолгоо

`acceptance.md` дахь gate бүрийг төхөөрөмж/орчин/commit/үр дүнтэй бөглөх хүртэл ✅ гэж тэмдэглэхгүй. JS export нь native build биш. SDK transport test нь бодит bucket test биш; локал mock PAID нь QPay sandbox биш.
