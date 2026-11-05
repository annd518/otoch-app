import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Тусламж · ОТОЧ",
  description: "ОТОЧ апп: холбоо барих, данс устгах, түгээмэл асуулт",
};

// Contacts come from the deployment, never hard-coded: set
// NEXT_PUBLIC_SUPPORT_EMAIL / NEXT_PUBLIC_SUPPORT_PHONE before going live.
const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
const phone = process.env.NEXT_PUBLIC_SUPPORT_PHONE;

export default function SupportPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <article className="rounded-xl bg-white px-5 py-6 shadow-sm space-y-6 text-gray-800">
        <h1 className="text-2xl font-bold text-gray-900">ОТОЧ · Тусламж</h1>

        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-900"
        >
          ОТОЧ бол яаралтай тусламжийн үйлчилгээ биш. Амь насанд аюултай үед{" "}
          <a href="tel:103" className="font-bold underline">
            103
          </a>{" "}
          руу залгана уу.
        </div>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Холбоо барих</h2>
          {email || phone ? (
            <ul className="space-y-1">
              {email && (
                <li>
                  И-мэйл:{" "}
                  <a className="text-[#11589F] underline" href={`mailto:${email}`}>
                    {email}
                  </a>
                </li>
              )}
              {phone && (
                <li>
                  Утас:{" "}
                  <a className="text-[#11589F] underline" href={`tel:${phone}`}>
                    {phone}
                  </a>
                </li>
              )}
            </ul>
          ) : (
            <p className="text-gray-500">Холбоо барих мэдээлэл удахгүй нэмэгдэнэ.</p>
          )}
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Түгээмэл асуулт</h2>
          <dl className="space-y-3">
            <div>
              <dt className="font-semibold">Хэрхэн сувилагч дуудах вэ?</dt>
              <dd>
                Апп-ын нүүр хуудаснаас «Сувилагч дуудах» → үйлчилгээ сонгох → хаяг,
                цаг → асуулга бөглөх → QPay-ээр төлөх.
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Цагаа өөрчлөх, цуцлах</dt>
              <dd>«Захиалга» цэснээс тухайн захиалгыг нээж «Өөр цаг сонгох» эсвэл «Захиалга цуцлах».</dd>
            </div>
            <div>
              <dt className="font-semibold">Данс устгах</dt>
              <dd>
                Апп-аас «Нүүр хуудас» → «Данс устгах хүсэлт», эсвэл дээрх холбоо
                барих хаягаар хүсэлт илгээнэ. Хуулиар хадгалах шаардлагатай
                эмнэлзүйн болон төлбөрийн бүртгэлээс бусдыг устгана.
              </dd>
            </div>
          </dl>
        </section>
      </article>
      <nav className="mt-6 flex gap-4 text-sm text-gray-600">
        <Link href="/privacy" className="underline">
          Нууцлалын бодлого
        </Link>
      </nav>
    </main>
  );
}
