# L1-1 Build readiness: iOS ба Android

| Талбар | Утга |
|---|---|
| Огноо | 2026-10-11 |
| Branch / суурь commit | `work/mobile-l1-1` / `aacfaad` |
| Хамрах хүрээ | `App/` (Expo, React Native) |
| Өнөөдрийн нотолгооны түвшин | Код уншсан, lockfile-ээр install хийсэн, lint, typecheck, JS bundle export ажиллуулсан. **Ямар ч build хийгээгүй, store руу upload хийгээгүй.** |

**Төлөвийн тэмдэглэгээ.**

- **Баталгаажсан**: repo эсвэл локал шалгалтаар нотлогдсон.
- **Дутуу**: repo-д байх ёстой зүйл байхгүй, эсвэл шийдвэр гараагүй.
- **Эрхгүй тул шалгаагүй**: account эсвэл console-ийн эрх шаардлагатай. Repo-д мэдээлэл байхгүй нь account байхгүй гэсэн үг **биш**.

## 1. Нотолгооны шат

Нэг шатны нотолгоо дараагийн шатыг баталгаажуулахгүй.

| # | Шат | 2026-10-11-ний байдал |
|---|---|---|
| 1 | Код, тохиргоо уншсан | Хийсэн |
| 2 | Lockfile-ээр install, lint, typecheck | Хийсэн (дүн 3-р хэсэгт) |
| 3 | Expo Go дээр бодит төхөөрөмжид ажилласан | Хийгээгүй |
| 4 | Simulator/emulator дээр development build | Хийгээгүй. Энэ Mac дээр Xcode, Android SDK байхгүй. |
| 5 | Локал release build (`.ipa`, `.aab`) | Хийгээгүй |
| 6 | Cloud build (EAS эсвэл CI) | Хийгээгүй |
| 7 | TestFlight / Play internal руу upload | Хийгээгүй |
| 8 | Tester бодит төхөөрөмж дээр суулгаж шалгасан | Хийгээгүй |

## 2. Хоёр платформд нийтлэг

| Зүйл | Төлөв | Нотолгоо ба тайлбар |
|---|---|---|
| Expo SDK | Баталгаажсан | `expo 57.0.27` (`App/package.json:20`, lockfile). 2026-10-11-нд npm-ийн `latest` ба `sdk-57` tag-тай ижил. |
| React Native, React | Баталгаажсан | `react-native 0.86.3` (`0.86-stable` tag), `react 19.2.3`. SDK-тэй нийцэх эсэх 3-р хэсэгт. |
| Package manager | Баталгаажсан | npm, `App/package-lock.json` (lockfileVersion 3). yarn, pnpm, bun lockfile байхгүй. |
| Node хувилбар | Дутуу | Шаардлага: `^20.19.4 \|\| ^22.13.0 \|\| ^24.3.0` (lockfile дахь `react-native`, `metro`-ийн `engines`). Repo-д `.nvmrc`, `engines` байхгүй. Энэ Mac дээр Node суугаагүй. Шалгалтыг түр хавтсанд татсан Node 22.23.3-аар хийсэн. |
| App нэр, slug, scheme | Дутуу | `App/app.json:3-4,8` нь `"App"`, `"App"`, `"app"`. Бүтээгдэхүүний шийдвэр хэрэгтэй. Slug-ийг EAS project холбохоос өмнө тогтооно. |
| App icon, splash | Дутуу | `assets/images/icon.png` 1024×1024, alpha-гүй тул техникийн шаардлага хангана. Гэхдээ Expo template-ийн анхны зураг. Android adaptive icon мөн адил. |
| Хувилбар | Дутуу | `App/app.json:5` нь `"1.0.0"`. iOS `buildNumber`, Android `versionCode` байхгүй. Гараар эсвэл EAS remote versioning ашиглах эсэхийг шийднэ. |
| Expo / EAS project | Дутуу | `eas.json`, `extra.eas.projectId`, `owner` байхгүй. Expo account байгаа эсэх: эрхгүй тул шалгаагүй. |
| Өөр build pipeline | Дутуу (шийдвэр) | `.github/workflows`, fastlane, Codemagic, Bitrise тохиргоо repo-д байхгүй. `App/.gitignore:42-43` нь `/ios`, `/android`-ийг ignore хийдэг тул native хавтсыг build үед үүсгэх (CNG) загвартай. |
| Staging API URL | Дутуу | Repo-д байхгүй. Backend-ийн төлөвлөгөөгөөр staging 10-16-нд "эрх байвал" гарна (`origin/work/backend-l1-1:docs/l1-1-backend-plan.md`). `App/utils/env.ts:19-20` нь `EXPO_PUBLIC_API_URL`-ийг дэмждэг. Утга өгөхгүй бол release build `localhost` эсвэл `10.0.2.2` руу хандаж ажиллахгүй. iOS ATS, Android cleartext хориг тул staging заавал HTTPS байна. |
| Нууц утга | Баталгаажсан | `App/`-д `.env`, key, certificate байхгүй. `.gitignore`-ууд `*.p12`, `*.p8`, `*.jks`, `*.keystore`, `*.mobileprovision`-ийг хаадаг. `EXPO_PUBLIC_*` утга bundle-д орох тул тэнд нууц хадгалахгүй. |
| Камер, зургийн permission | Дутуу | Одоо шаардлагагүй, учир нь camera, image-picker модуль байхгүй. L1-1 S4-д `expo-image-picker` нэмэхэд usage string заавал хэрэгтэй. |
| Байршлын permission | Дутуу (шийдвэр) | Одоо байхгүй. Хаягаа газрын зураг дээр гараар тэмдэглэвэл permission хэрэггүй. "Миний байршил" товч хэрэгтэй бол зөвхөн foreground permission. Хүүхэд хэрэглэгчийн апп background байршил шаардахгүй. |
| `react-native-maps` | Дутуу | `App/package.json:37` 1.27.2. Android build-д Google Maps API key хэрэгтэй. Package-ийн config plugin `androidGoogleMapsApiKey` сонголттой (`node_modules/react-native-maps/plugin/build/android.js:47-48`) ч `App/app.json:28-46`-ийн plugins-д нэмэгдээгүй. iOS анхдагчаар Apple Maps ашигладаг. |
| Нууцлалын бодлогын URL | Дутуу | Хоёр store эрүүл мэндийн өгөгдөл цуглуулдаг аппаас шаарддаг. Repo-д байхгүй. |
| Expo Go | Дутуу | Туршаагүй. Одоогийн dependency бүгд SDK 57-ийн жагсаалтад багтдаг ч Expo Go дээр ажиллах нь баталгаажаагүй. |
| Бодит төхөөрөмжийн тест | Дутуу | Нэг ч төхөөрөмж дээр туршаагүй. |

## 3. Локал шалгалтын дүн

| Шалгалт | Дүн | Нотолгооны шат |
|---|---|---|
| `npm ci` (Node 22.23.3, npm 10.9.9) | Амжилттай, 856 package. Lockfile өөрчлөгдөөгүй. | 2 |
| SDK 57-ийн хувилбартай тулгах | Бүх Expo, native package `bundledNativeModules.json`-тэй таарсан | 2 |
| ESLint | 5 error, 7 warning. Дэлгэрэнгүй `docs/l1-1-mobile-plan.md` 8.1-д. | 2 |
| TypeScript `tsc --noEmit` | 12 error, бүгд ашиглагдаагүй `App/services/api.ts`-д. Дэлгэрэнгүй 8.2-т. | 2 |
| `expo config --type public` | Identifier, owner, EAS project байхгүйг баталсан | 1 |
| `expo export` (iOS, Android JS bundle) | Амжилттай, Hermes bytecode үүссэн | 2. Native build биш. |
| `expo-doctor` | Ажиллуулаагүй (10-12-ны 8-р алхам) | — |
| Expo Go, simulator, native build, cloud build, store upload | Хийгээгүй | — |

## 4. iOS

| Зүйл | Төлөв | Нотолгоо ба тайлбар |
|---|---|---|
| Bundle identifier | Дутуу | `App/app.json:11-13` дээр зөвхөн `supportsTablet`. Утгыг эзэмшигч өгнө. Таамаглаж бичихгүй. Нэг удаа App Store Connect-д бүртгэгдвэл солигдохгүй. |
| `buildNumber` | Дутуу | Байхгүй. |
| Apple Developer Program, Team ID | Эрхгүй тул шалгаагүй | Membership идэвхтэй эсэх, mobile хөгжүүлэгчид ямар role өгөхийг эзэмшигч баталгаажуулна. |
| App Store Connect app record | Эрхгүй тул шалгаагүй | Bundle ID бүртгэгдсэний дараа үүсгэнэ. |
| Signing (distribution certificate, provisioning profile) | Эрхгүй тул шалгаагүй | Repo-д байхгүй нь зөв. EAS managed credentials эсвэл гараар удирдах эсэхийг сонгоно. |
| Export compliance | Дутуу | `ITSAppUsesNonExemptEncryption` тохируулаагүй. Зөвхөн HTTPS ашиглавал ихэвчлэн `false`. Шийдвэрийг эзэмшигч гаргана. |
| Info.plist usage string | Дутуу | Камер, зургийн сан (S4), байршлыг (сонголттой) нэмэх үед. |
| iPad дэмжлэг | Дутуу (шийдвэр) | `supportsTablet: true` (`App/app.json:12`). App Store review-д iPad screenshot, iPad дээрх шалгалт шаардлагатай болно. TestFlight-д нөлөөгүй. |
| TestFlight tester access | Эрхгүй тул шалгаагүй | Internal tester (App Store Connect хэрэглэгч, 100 хүртэл) review-гүй. External tester Beta App Review шаарддаг. |
| Локал iOS build | Дутуу | Энэ Mac дээр зөвхөн Command Line Tools байна, Xcode байхгүй. |
| QPay deeplink | Дутуу | `Linking.canOpenURL` ашиглах бол банкны scheme-үүдийг `LSApplicationQueriesSchemes`-д нэмнэ. |

## 5. Android

| Зүйл | Төлөв | Нотолгоо ба тайлбар |
|---|---|---|
| `package` | Дутуу | `App/app.json:14-23` дээр байхгүй. Утгыг эзэмшигч өгнө. Play-д нэг удаа нийтлэгдвэл солигдохгүй. |
| `versionCode` | Дутуу | Байхгүй. |
| Google Play Console эрх | Эрхгүй тул шалгаагүй | Developer account-ийн төрөл (хувь хүн эсвэл байгууллага), mobile хөгжүүлэгчийн эрхийг баталгаажуулна. |
| Play App Signing, upload key | Эрхгүй тул шалгаагүй | Шинэ апп Play App Signing ашиглана. Upload keystore repo-д байхгүй нь зөв. Хэн хадгалахыг шийднэ. |
| Анхны AAB upload | Дутуу | Play API болон EAS Submit ажиллахын тулд эхний AAB-г Play Console-д гараар upload хийнэ. |
| Internal testing | Эрхгүй тул шалгаагүй | 100 хүртэл tester, имэйлээр. |
| Closed testing | Эрхгүй тул шалгаагүй | 2023-11-13-аас хойш үүссэн хувь хүний account production-д гарахаас өмнө 12-оос доошгүй tester-тэй 14 хоногийн closed test шаарддаг. Internal testing-д энэ хамаарахгүй. Account-ийн төрлийг шалгана. |
| Play Console "App content" | Эрхгүй тул шалгаагүй | Data safety, нууцлалын бодлого, эрүүл мэндийн аппын мэдүүлэг зэргийг track тус бүрт шаардлагатай эсэхийг console дээр шалгана. |
| Permission | Дутуу | Камерын permission S4-д нэмэгдэнэ. Галерейд Android photo picker ашиглаж `READ_MEDIA_IMAGES`-ээс зайлсхийнэ. Эцсийн manifest-ийг build-ийн дараа шалгана. |
| Google Maps API key | Дутуу | `react-native-maps`-д хэрэгтэй. Key-ийг repo-д биш, build-ийн нууц хувьсагчаар өгнө. |
| Edge-to-edge | Баталгаажсан | `edgeToEdgeEnabled: true` (`App/app.json:21`). |
| Локал Android build | Дутуу | Энэ Mac дээр JDK, Android SDK байхгүй. |

## 6. Build pipeline-ийн сонголт

| Сонголт | Шаардлага | Тайлбар |
|---|---|---|
| EAS Build (cloud) | Expo account, `eas.json`, project ID | Xcode, Android SDK локал шаардлагагүй. Credential удирдлагатай. Үнэгүй plan-д хязгаар бий тул төлбөртэй plan хэрэгтэй эсэхийг шийднэ. |
| EAS local build | Дээрхтэй адил, нэмээд Xcode (iOS), JDK + Android SDK (Android) | Cloud quota зарцуулахгүй. Энэ Mac дээр toolchain одоо байхгүй. |
| `expo prebuild` + Xcode / Gradle | Xcode, JDK, Android SDK, signing-ийг гараар | EAS шаардлагагүй. `prebuild` нь `ios/`, `android/` үүсгэдэг тул эхлээд тусдаа branch дээр турших. |
| CI (GitHub Actions + fastlane, Codemagic гэх мэт) | CI account, macOS runner, нууц хувьсагч | Repo-д тохиргоо одоо байхгүй. macOS runner төлбөртэй байж болно. |

**Санал.** L1-1-ийн 6 хоногт EAS Build хамгийн бага бэлтгэл шаардана. Гэхдээ account, төлбөрийн шийдвэрийг эзэмшигч гаргана. EAS-гүй бол Xcode болон Android Studio суусан Mac хэрэгтэй.

## 7. 2026-10-12-ны build бэлтгэлийн дараалал

Account нээх, төлбөр хийх, cloud build эхлүүлэх, store руу upload хийх алхам бүр эзэмшигчийн зөвшөөрлөөр явна.

| # | Алхам | Хариуцагч | Гаралт | Блоклогч |
|---|---|---|---|---|
| 1 | origin-ийг fetch хийж backend-ийн API санал (`origin/work/backend-l1-1`) шинэчлэгдсэн эсэхийг шалгах. `docs/l1-1-mobile-plan.md` 4.2-ын GAP-1…7-г backend-тэй ярилцах. | Mobile + backend | Тохиролцсон жагсаалт | — |
| 2 | App-ийн нэр, slug, scheme, iOS bundle ID, Android package-ийг бичгээр батлах | Бүтээгдэхүүний эзэн | Батлагдсан утгын жагсаалт | Үгүй бол 7-12 зогсоно |
| 3 | Apple Developer team, App Store Connect эрх, Google Play Console эрх, Expo account-ийн төлөвийг баталгаажуулж mobile хөгжүүлэгчийг урих | Account эзэмшигч | Эрх олгогдсон | Үгүй бол 9-12 зогсоно |
| 4 | Build pipeline сонгох (6-р хэсэг), төлбөрийн шийдвэр | Эзэмшигч + mobile | Шийдвэр | 9-12 |
| 5 | Staging API-ийн HTTPS URL, тест хэрэглэгч авах | Backend | URL, тест account | 8, 11 |
| 6 | Локал toolchain суулгах: Node 22 эсвэл 24 LTS. Локал build сонгосон бол Xcode, Android Studio, JDK. | Mobile | `node -v` ажиллана | — |
| 7 | `app.json`-д батлагдсан identifier, хувилбар, нэрийг оруулах. `eas.json`-д development, preview, production profile ба profile бүрийн `EXPO_PUBLIC_API_URL`. Тусдаа PR. | Mobile | PR | 2, 4, 5 |
| 8 | `npx expo-doctor` ба `npx expo install --check` ажиллуулж зөрүүг тусдаа PR-ээр засах | Mobile | Цэвэр doctor тайлан | 6 |
| 9 | Бодит iPhone, Android утсан дээр Expo Go-оор staging-тай турших | Mobile | Шат 3-ын нотолгоо | 5 |
| 10 | Development эсвэл preview build хийж бодит төхөөрөмжид суулгах | Mobile | Шат 4-6-ын нотолгоо | 3, 4, 7 |
| 11 | App Store Connect app record, Play Console app үүсгэх. Эхний AAB-г гараар upload хийх. Play App Signing идэвхжүүлэх. | Account эзэмшигч + mobile | Store дээрх app record | 3, 10 |
| 12 | TestFlight internal, Play internal track руу upload, tester урих | Account эзэмшигч + mobile | Шат 7-8-ын нотолгоо | 11 |

10-12-нд 1-9-р алхмыг дуусгах зорилготой. 10-12-р алхам account, шийдвэрээс хамаарна.

## 8. Шаардлагатай identifier, account, access

| Зүйл | Хэнээс | Тайлбар |
|---|---|---|
| App-ийн дэлгэцийн нэр | Бүтээгдэхүүний эзэн | OTOCH эсэх |
| Expo slug, URL scheme | Бүтээгдэхүүний эзэн | Одоо `App` / `app` |
| iOS bundle identifier | Бүтээгдэхүүний эзэн | Таамаглахгүй |
| Android package name | Бүтээгдэхүүний эзэн | Таамаглахгүй |
| Apple Developer team ID, App Store Connect role | Apple account эзэмшигч | App Manager эсвэл Admin |
| Google Play developer account, release эрх | Play account эзэмшигч | Account-ийн төрөл |
| Expo account эсвэл organization, project ID | Expo account эзэмшигч | EAS сонгосон бол |
| Signing-ийн хариуцлага | Account эзэмшигч | Distribution certificate, upload keystore хаана хадгалагдах |
| Staging API HTTPS URL | Backend | Profile бүрт |
| QPay sandbox | Backend | Credential зөвхөн серверт |
| Google Maps API key (Android) | Account эзэмшигч | Нууц хувьсагчаар |
| Нууцлалын бодлого, дэмжлэгийн URL | Бүтээгдэхүүний эзэн | Хоёр store |
| Tester-ийн жагсаалт | Бүтээгдэхүүний эзэн | iOS-д Apple ID имэйл, Android-д Google account имэйл |
| Бодит төхөөрөмж | Баг | Дор хаяж нэг iPhone, нэг Android |
