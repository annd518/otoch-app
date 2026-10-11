> Шинэчлэл: v2.0 агуулгын approval gate хаагдсан. [PDF эх ба баталгаа](source/approval.md). Approved import багц бэлэн; одоогийн DB-д apply хийгдээгүй. Доорх 128 тест нь өмнөх хэрэгжүүлэлтийн тайлан.

# L1-1 1–5 хэрэгжүүлэлтийн validation

Суурь main: `161950fe670b44b4398b593023618430a063ece0`. Ажлын branch: `feat/l1-1-acceptance`.

| Шалгалт | Үр дүн | Хязгаар |
|---|---|---|
| Backend regression | 128/128 | Шинэ түр UTF8 PostgreSQL; бодит DB биш |
| Migration | 6 migration deploy амжилттай | Зөвхөн хоосон түр DB; existing DB apply хийгдээгүй |
| Backend typecheck/build | Амжилттай | Docker image build биш |
| Prisma validate | Хүчинтэй | Холбогдохгүй placeholder URL; бодит DB шалгаагүй |
| Mobile lint/typecheck | Алдаагүй | Native/device rendering биш |
| Mobile unit | 152/152 | Автомат логикийн шалгалт |
| iOS/Android export | Амжилттай | Hermes JS bundle; signed/native build биш |
| Staff Next build | Амжилттай, `/dashboard/orders` | Локал build |
| Staff browser smoke | assign/version payload, empty/error PASS | Mock HTTP responses; бодит staff/backend browser E2E биш |
| S3 SDK transport | PUT/GET/DELETE, ACL байхгүй, private headers, error mapping PASS | Fake transport; provider/bucket policy acceptance биш |
| Storage cleanup | Orphan remove, ACTIVE preserve, rollback/removal failure queue retry PASS | Memory adapter + isolated API/DB |
| Capacity | Зэрэг хоёр invoice хүсэлт → 1 invoice, 1 conflict | Нэг автомат процессын зэрэг HTTP; хоёр төхөөрөмж биш |
| Staff API | Role/owner/version/status/concurrent assign/start/event PASS | Түр DB дэх бодит API тест |
| Content import | Dry-run, immutable version/replay, catalog metadata, atomic rollback, slot conflict PASS | Test-only approval; эмнэлзүйн баталгаа биш |

Browser mock review зураг: [staff-mock-review.png](staff-mock-review.png). Дэлгэцийн synthetic пациент/нэр/төлбөр бодит биш. Desktop харагдах байдал review хийсэн; 200% font/small mobile/VoiceOver/TalkBack энэ шинэ өөрчлөлтөөр төхөөрөмж дээр шалгаагүй.

Бодит `.env`, WIN1252 `.local-pg`, хэрэглэгчийн DB, signing файлд хүрээгүй. Docker CLI энэ компьютерт олдоогүй тул image build/compose runtime шалгаагүй. `docker-compose.staging-test.yml` нь deploy template; ажиллаж буй staging биш.

1–5 нийт **🟡**. Approved багцын DB publication, бүсийн бодит геометр/slot, HTTPS staging, private bucket, identifier/signing болон iPhone/Android evidence дутуу. [Acceptance checklist](acceptance.md) бүх external gate хүлээгдэж байна. QPay mock-г sandbox гэж тооцоогүй.
