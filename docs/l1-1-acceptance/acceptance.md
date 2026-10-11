# 1–5 acceptance checklist

Төлөв: бүх external gate **ХҮЛЭЭГДЭЖ БАЙНА**. v2.0-ийн үнэ/асуулт/дүрмийг эзэмшигч чатад баталсан: source/approval.md. Кодын автомат шалгалтыг validation.md-д тусад нь бүртгэнэ.

Gate бүрт backend/mobile/staff SHA, HTTPS environment, iPhone/Android model+OS, tester, огноо, screenshot/log (нууцгүй), expected/actual, pass/fail оруулна.

- [ ] Батлагдсан 10 үйлчилгээ / 4 бүлэг / үнэ / бэлтгэл; нүүрээс хоёр товшилт
- [ ] Дөрвөн алхам, буцах/retry/resume/re-login; нэг key нэг order
- [ ] Consent/signer/birthYear/family/referral/эм дутуу, хугацаа дууссан эм, эхний тун хориг
- [ ] +2 цаг, зөв бүс/координат, slot duration/capacity; хоёр төхөөрөмжийн зэрэг invoice slot захиалга
- [ ] Батлагдсан 6 RF; incomplete/хуучирсан; нэг positive шууд блок; PATCH/quote/payment/өөр төхөөрөмж тойрохгүй
- [ ] 103 төхөөрөмж дээр; emergency draft үргэлжлүүлэх боломжгүй
- [ ] Private bucket upload/read/delete/retry; өөр owner404; public object URL access denied
- [ ] JPEG/PNG/HEIC, 10MB, global5/service2/3; provider timeout, DB failure/orphan, delete failure/cleanup retry
- [ ] Permission татгалзах/камер/галерей iPhone+Android
- [ ] ADMIN/MEDICAL_ADMIN assign/reassign; зөвхөн assigned NURSE ETA/start/complete
- [ ] Version conflict/давхар start/complete; event ordering
- [ ] Mobile10сек polling/foreground; staff өөрчлөлт харагдана; offline stale тайлбар
- [ ] Жижиг дэлгэц/keyboard/safe area/200% font/VoiceOver/TalkBack
- [ ] Mock/staging шошго бүх урсгалд; бодит төлбөр гэж харуулахгүй

Гаднын blocker: approved content-ийн DB publication, бодит region geometry/slots, hosting+HTTPS+UTF8 DB, private S3 bucket/IAM, signing+identifier, хоёр төхөөрөмж. Эдгээрийг зохиож нөхөхгүй.
