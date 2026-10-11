// app/page.tsx
"use client";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("children");
  const [counts, setCounts] = useState({ nurses: 0, families: 0, savings: 0 });
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsVisible, setStatsVisible] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Scroll animations
    const handleScroll = () => {
      const elements = document.querySelectorAll('.scroll-animate');
      elements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.8) {
          el.classList.add('active');
        }
      });
    };

    // Stats counter animation
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !statsVisible) {
          setStatsVisible(true);
          animateCount(0, 1000, setCounts, 'nurses', 2000);
          animateCount(0, 100, setCounts, 'families', 2000, 'K');
          animateCount(0, 2, setCounts, 'savings', 2000, 'B');
        }
      },
      { threshold: 0.5 }
    );

    if (statsRef.current) {
      observer.observe(statsRef.current);
    }

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (statsRef.current) observer.unobserve(statsRef.current);
    };
  }, [statsVisible]);

  const animateCount = (
    start: number,
    end: number,
    setter: any,
    key: string,
    duration: number,
    suffix: string = ''
  ) => {
    const increment = end / (duration / 16);
    let current = start;
    const timer = setInterval(() => {
      current += increment;
      if (current >= end) {
        current = end;
        clearInterval(timer);
      }
      setter((prev: any) => ({ ...prev, [key]: Math.floor(current) + suffix }));
    }, 16);
  };

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/95 backdrop-blur-md shadow-sm z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
              PariwarCare
            </h1>
            <div className="hidden md:flex space-x-8">
              <a
                href="#solution"
                className="text-gray-700 hover:text-blue-600 transition"
              >
                Шийдэл
              </a>
              <a
                href="#impact"
                className="text-gray-700 hover:text-blue-600 transition"
              >
                Нөлөө
              </a>
              <a
                href="#pricing"
                className="text-gray-700 hover:text-blue-600 transition"
              >
                Үнэ
              </a>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/auth/login"
                className="text-blue-600 hover:text-blue-700 font-medium transition"
              >
                Нэвтрэх
              </Link>
              <Link
                href="/auth/register"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                Эхлэх
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 via-white to-blue-50 overflow-hidden">
        {/* Animated background circles */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-float"></div>
        <div
          className="absolute bottom-20 right-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-float"
          style={{ animationDelay: "1s" }}
        ></div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className={`${mounted ? "animate-fadeInLeft" : "opacity-0"}`}>
              {/* <div className="inline-flex items-center bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium mb-6 animate-pulse-slow">
                <span className="relative flex h-3 w-3 mr-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                </span>
                2M+ families connected
              </div> */}

              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Холбож өгөх асаргаа{" "}
                <span className="block text-blue-600 mt-2">
                  Зай холдох тусам
                </span>
              </h1>

              <p className="text-xl text-gray-600 mb-8">
                Эцэг эхийн эрүүл мэндийг мэргэжлийн түвшинд хянах үйлчилгээ.
                Хаанаас ч удирдах боломжтой.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Link
                  href="/auth/register"
                  className="bg-blue-600 text-white px-8 py-4 rounded-lg hover:bg-blue-700 transform hover:scale-105 transition-all duration-300 text-center font-semibold shadow-xl hover:shadow-2xl"
                >
                  Өнөөдөр асарч эхлээрэй
                </Link>
                <a
                  href="#solution"
                  className="border-2 border-blue-600 text-blue-600 px-8 py-4 rounded-lg hover:bg-blue-50 transform hover:scale-105 transition-all duration-300 text-center font-semibold"
                >
                  Хэрхэн ажилладаг вэ
                </a>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { value: "₹5K", label: "сард" },
                  { value: "45min", label: "гэрийн үзлэг" },
                  { value: "24/7", label: "хяналт" },
                ].map((stat, i) => (
                  <div
                    key={i}
                    className={`text-center p-4 bg-white rounded-lg shadow-md animate-fadeInUp delay-${
                      (i + 2) * 100
                    }`}
                  >
                    <div className="text-2xl font-bold text-blue-600">
                      {stat.value}
                    </div>
                    <div className="text-sm text-gray-600">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Dashboard Preview */}
            <div className={`${mounted ? "animate-fadeInRight" : "opacity-0"}`}>
              <div className="relative">
                <div className="bg-white rounded-2xl shadow-2xl p-6 transform hover:scale-105 transition-all duration-500 hover:shadow-3xl">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center animate-pulse-slow">
                        <svg
                          className="w-6 h-6 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Сүүлийн үзлэг</div>
                        <div className="font-semibold text-gray-900">
                          2 өдрийн өмнө
                        </div>
                      </div>
                    </div>
                    <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                      Эрүүл
                    </div>
                  </div>

                  <div className="space-y-3">
                    {[
                      {
                        label: "Цусны даралт",
                        value: "120/80",
                        status: "good",
                      },
                      { label: "Цусан дахь сахар", value: "Хэвийн", status: "good" },
                      { label: "Зүрхний цохилт", value: "72 цохилт/мин", status: "good" },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className={`flex justify-between items-center p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg transform hover:scale-105 transition-all duration-300 cursor-pointer animate-fadeInUp delay-${
                          (i + 5) * 100
                        }`}
                      >
                        <span className="text-gray-700 font-medium">
                          {item.label}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-blue-600">
                            {item.value}
                          </span>
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 p-4 bg-blue-600 text-white rounded-lg text-center font-semibold">
                    Дараагийн үзлэг: 5 өдрийн дараа
                  </div>
                </div>

                {/* Floating elements */}
                <div className="absolute -top-4 -right-4 w-20 h-20 bg-blue-500 rounded-full opacity-20 animate-float"></div>
                <div
                  className="absolute -bottom-4 -left-4 w-16 h-16 bg-purple-500 rounded-full opacity-20 animate-float"
                  style={{ animationDelay: "1.5s" }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Statement - Concise */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 scroll-animate">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Хямрал
            </h2>
            <p className="text-xl text-gray-600">
              Гадаадад 2 сая гаруй иргэн. 2.5 сая эцэг эх ганцаараа.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="relative group scroll-animate">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-500 rounded-2xl blur opacity-25 group-hover:opacity-50 transition"></div>
              <div className="relative bg-white border-2 border-red-200 rounded-2xl p-8 hover:border-red-400 transition-all duration-300">
                <h3 className="text-3xl font-bold text-red-900 mb-6">
                  Асуудал
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="text-3xl">😔</div>
                    <p className="text-lg text-gray-700">
                      "Би зүгээр" - 75% нь өвчнөө нуудаг
                    </p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="text-3xl">⚠️</div>
                    <p className="text-lg text-gray-700">
                      Өвчний 40% нь хэтэрхий оройтож илэрдэг
                    </p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="text-3xl">💔</div>
                    <p className="text-lg text-gray-700">
                      Яаралтай байдал үүсэх хүртэл эмнэлэгт очдоггүй
                    </p>
                  </div>
                </div>
                <div className="mt-6 text-4xl font-bold text-red-600">
                  ₹800K
                </div>
                <div className="text-red-700">Яаралтай тусламжийн зардал</div>
              </div>
            </div>

            <div className="relative group scroll-animate">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl blur opacity-25 group-hover:opacity-50 transition"></div>
              <div className="relative bg-white border-2 border-blue-200 rounded-2xl p-8 hover:border-blue-400 transition-all duration-300">
                <h3 className="text-3xl font-bold text-blue-900 mb-6">
                  Шийдэл
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="text-3xl">🏠</div>
                    <p className="text-lg text-gray-700">Сар бүрийн гэрийн үзлэг</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="text-3xl">👩‍⚕️</div>
                    <p className="text-lg text-gray-700">Итгэлтэй нэг сувилагч</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="text-3xl">📱</div>
                    <p className="text-lg text-gray-700">
                      Танд бодит цагийн мэдэгдэл
                    </p>
                  </div>
                </div>
                <div className="mt-6 text-4xl font-bold text-blue-600">₹5K</div>
                <div className="text-blue-700">Урьдчилан сэргийлэлт /сар</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Solution Tabs */}
      <section
        id="solution"
        className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 to-white"
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 scroll-animate">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Хэрхэн ажилладаг вэ
            </h2>
            <p className="text-xl text-gray-600">
              Гурван өнцөг. Нэг шийдэл.
            </p>
          </div>

          {/* Interactive Tabs */}
          <div className="flex justify-center mb-8 scroll-animate">
            <div className="inline-flex bg-white rounded-xl shadow-lg p-2">
              {[
                { id: "children", label: "Танд", icon: "📱" },
                { id: "parents", label: "Эцэг эхэд", icon: "👴" },
                { id: "system", label: "Улс оронд", icon: "🏥" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
                    activeTab === tab.id
                      ? "bg-blue-600 text-white shadow-lg transform scale-105"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-2xl shadow-2xl p-8 min-h-[400px]">
            {activeTab === "children" && (
              <div className="animate-fadeInUp">
                <h3 className="text-3xl font-bold text-blue-900 mb-6">
                  Таны хяналтын төв
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  {[
                    {
                      icon: "📊",
                      title: "Бодит цагийн самбар",
                      desc: "Эрүүл мэндийн хандлагыг шууд хянах",
                    },
                    {
                      icon: "🚨",
                      title: "Шуурхай мэдэгдэл",
                      desc: "Ямар нэг зүйл буруу бол шууд мэдэх",
                    },
                    {
                      icon: "💬",
                      title: "Видео дуудлага",
                      desc: "Сувилагч болон эцэг эхтэйгээ ярих",
                    },
                    {
                      icon: "💳",
                      title: "Хялбар төлбөр",
                      desc: "Хаанаас ч төлөх",
                    },
                  ].map((feature, i) => (
                    <div
                      key={i}
                      className="flex items-start space-x-4 p-4 rounded-lg hover:bg-blue-50 transition-all duration-300 transform hover:scale-105 cursor-pointer"
                    >
                      <div className="text-4xl">{feature.icon}</div>
                      <div>
                        <h4 className="font-bold text-lg text-gray-900">
                          {feature.title}
                        </h4>
                        <p className="text-gray-600">{feature.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "parents" && (
              <div className="animate-fadeInUp">
                <h3 className="text-3xl font-bold text-blue-900 mb-6">
                  Гэртээ тав тухтай
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  {[
                    {
                      icon: "🏠",
                      title: "Гэрийн үзлэг",
                      desc: "Сар бүр 45 минутын асаргаа",
                    },
                    {
                      icon: "🩺",
                      title: "Бүрэн шинжилгээ",
                      desc: "Цус, ЗЦБ, амин үзүүлэлт - гэртээ",
                    },
                    {
                      icon: "🗣️",
                      title: "Эх хэл дээрх тайлан",
                      desc: "Дуут тайлбартай",
                    },
                    {
                      icon: "💊",
                      title: "Эм хүргэлт",
                      desc: "Эм уултыг хянах",
                    },
                  ].map((feature, i) => (
                    <div
                      key={i}
                      className="flex items-start space-x-4 p-4 rounded-lg hover:bg-blue-50 transition-all duration-300 transform hover:scale-105 cursor-pointer"
                    >
                      <div className="text-4xl">{feature.icon}</div>
                      <div>
                        <h4 className="font-bold text-lg text-gray-900">
                          {feature.title}
                        </h4>
                        <p className="text-gray-600">{feature.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "system" && (
              <div className="animate-fadeInUp">
                <h3 className="text-3xl font-bold text-blue-900 mb-6">
                  Үндэсний хэмжээний нөлөө
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  {[
                    {
                      icon: "👩‍⚕️",
                      title: "1000+ сувилагчийн ажлын байр",
                      desc: "Оюуны шилжилтийг зогсоох",
                    },
                    {
                      icon: "💰",
                      title: "₹2 тэрбум хэмнэлт",
                      desc: "Яаралтай тусламжийн ачааллыг бууруулах",
                    },
                    {
                      icon: "📈",
                      title: "40% эрт илрүүлэлт",
                      desc: "Хүндрэлээс сэргийлэх",
                    },
                    {
                      icon: "🔄",
                      title: "Шинэ загвар",
                      desc: "Гадаад дахь иргэдийн санхүүжүүлсэн асаргаа",
                    },
                  ].map((feature, i) => (
                    <div
                      key={i}
                      className="flex items-start space-x-4 p-4 rounded-lg hover:bg-blue-50 transition-all duration-300 transform hover:scale-105 cursor-pointer"
                    >
                      <div className="text-4xl">{feature.icon}</div>
                      <div>
                        <h4 className="font-bold text-lg text-gray-900">
                          {feature.title}
                        </h4>
                        <p className="text-gray-600">{feature.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Impact Stats with Counter Animation */}
      <section
        id="impact"
        className="py-20 px-4 sm:px-6 lg:px-8 bg-white"
        ref={statsRef}
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 scroll-animate">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Бодит нөлөө
            </h2>
            <p className="text-xl text-gray-600">Чухал тоо баримт</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {[
              {
                value: counts.nurses,
                label: "Ажилд орсон сувилагч",
                icon: "👩‍⚕️",
                color: "blue",
              },
              {
                value: counts.families,
                label: "Холбогдсон гэр бүл",
                icon: "👨‍👩‍👧‍👦",
                color: "purple",
              },
              {
                value: `₹${counts.savings}`,
                label: "Хэмнэсэн эрүүл мэндийн зардал",
                icon: "💰",
                color: "green",
              },
            ].map((stat, i) => (
              <div
                key={i}
                className={`scroll-animate bg-gradient-to-br from-${stat.color}-50 to-white rounded-2xl p-8 text-center transform hover:scale-110 transition-all duration-500 shadow-lg hover:shadow-2xl cursor-pointer`}
              >
                <div className="text-6xl mb-4 animate-float">{stat.icon}</div>
                <div className="text-5xl font-bold text-gray-900 mb-2">
                  {stat.value}+
                </div>
                <div className="text-lg text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* ROI Highlight */}
          <div className="scroll-animate bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 rounded-2xl p-12 text-white text-center transform hover:scale-105 transition-all duration-500 shadow-2xl relative overflow-hidden">
            <div className="shimmer absolute inset-0"></div>
            <div className="relative z-10">
              <h3 className="text-3xl font-bold mb-4">Урьдчилан сэргийлэлтийн тооцоо</h3>
              <div className="text-7xl font-bold mb-4 animate-pulse-slow">
                13 жил
              </div>
              <p className="text-xl">
                Урьдчилан сэргийлсэн 1 яаралтай тохиолдол = 13 жилийн хяналт
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials - Compact */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 scroll-animate">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Бодит түүхүүд
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                quote:
                  "Сувилагч ээжийн маань даралт ихсэлтийг эрт илрүүлсэн. Түүний амийг аварсан.",
                author: "Ramesh S.",
                location: "Dubai",
                emoji: "🙏",
              },
              {
                quote: "Аав маань Маяа эгчид их дуртай. Одоо эмээ цагтаа уудаг болсон!",
                author: "Prajwal S.",
                location: "Melbourne",
                emoji: "❤️",
              },
              {
                quote:
                  "Би эцэг эх, үр хүүхдийн хоорондын гүүр. Хамгийн утга учиртай ажил.",
                author: "Maya T.",
                location: "Сувилагч, Катманду",
                emoji: "👩‍⚕️",
              },
            ].map((testimonial, i) => (
              <div
                key={i}
                className="scroll-animate bg-white p-6 rounded-xl shadow-lg hover:shadow-2xl transform hover:-translate-y-2 transition-all duration-500"
              >
                <div className="text-5xl mb-4">{testimonial.emoji}</div>
                <p className="text-gray-700 mb-4 italic">
                  "{testimonial.quote}"
                </p>
                <div className="font-semibold text-gray-900">
                  {testimonial.author}
                </div>
                <div className="text-sm text-gray-600">
                  {testimonial.location}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing - Simplified */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 scroll-animate">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Энгийн үнэ
            </h2>
            <p className="text-xl text-gray-600">
              Бүгд багтсан. Гэнэтийн зардалгүй.
            </p>
          </div>

          <div className="scroll-animate max-w-lg mx-auto">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-400 rounded-3xl blur opacity-25 group-hover:opacity-50 transition"></div>
              <div className="relative bg-white border-2 border-blue-200 rounded-3xl p-8 shadow-xl hover:border-blue-400 transition-all duration-300">
                <div className="text-center mb-8">
                  <div className="inline-block bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-semibold mb-4">
                    Бүрэн асаргаа
                  </div>
                  <div className="flex items-baseline justify-center mb-4">
                    <span className="text-6xl font-bold text-blue-600">
                      ₹5,000
                    </span>
                    <span className="text-gray-600 ml-2 text-xl">/сар</span>
                  </div>
                </div>

                <div className="space-y-3 mb-8">
                  {[
                    "Сар бүр 45 минутын гэрийн үзлэг",
                    "Эрүүл мэндийн бүрэн шинжилгээ",
                    "Бодит цагийн самбар",
                    "Эм хүргэлт",
                    "24/7 яаралтай тусламж",
                    "Видео зөвлөгөө",
                  ].map((feature, i) => (
                    <div key={i} className="flex items-center space-x-3">
                      <svg
                        className="w-6 h-6 text-blue-600 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>

                <Link
                  href="/auth/register"
                  className="block w-full bg-blue-600 text-white text-center px-8 py-4 rounded-xl hover:bg-blue-700 transform hover:scale-105 transition-all duration-300 font-bold text-lg shadow-lg hover:shadow-xl"
                >
                  Өнөөдөр эхлэх
                </Link>

                <p className="text-center text-sm text-gray-600 mt-4">
                  Олон улсын төлбөр • Хүссэн үедээ цуцлах
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-600 via-blue-500 to-purple-600 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-40 h-40 bg-white rounded-full animate-float"></div>
          <div
            className="absolute bottom-10 right-10 w-60 h-60 bg-white rounded-full animate-float"
            style={{ animationDelay: "1s" }}
          ></div>
        </div>

        <div className="max-w-4xl mx-auto text-center text-white relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 animate-fadeInUp">
            Тэр дуудлагыг бүү хүлээ
          </h2>
          <p className="text-xl mb-8 opacity-90 animate-fadeInUp delay-200">
            Эцэг эхийнхээ эрүүл мэндийг өнөөдрөөс хянаж эхлээрэй.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fadeInUp delay-400">
            <Link
              href="/auth/register"
              className="bg-white text-blue-600 px-8 py-4 rounded-lg hover:bg-gray-100 transform hover:scale-110 transition-all duration-300 font-bold text-lg shadow-2xl"
            >
              Одоо эхлэх
            </Link>
            <a
              href="#solution"
              className="border-2 border-white text-white px-8 py-4 rounded-lg hover:bg-white/10 transform hover:scale-110 transition-all duration-300 font-bold text-lg"
            >
              Дэлгэрэнгүй
            </a>
          </div>
          <p className="text-sm mt-8 opacity-75 animate-fadeInUp delay-600">
            Алсаас асарч буй 10,000+ гэр бүлд нэгдээрэй
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-white text-xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                PariwarCare
              </h3>
              <p className="text-sm">Эрүүл мэндээр дамжуулан гэр бүлүүдийг холбоно.</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Бүтээгдэхүүн</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="#solution"
                    className="hover:text-blue-400 transition"
                  >
                    Хэрхэн ажилладаг вэ
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-blue-400 transition">
                    Үнэ
                  </a>
                </li>
                <li>
                  <a href="#impact" className="hover:text-blue-400 transition">
                    Нөлөө
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Компани</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="hover:text-blue-400 transition">
                    Бидний тухай
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-blue-400 transition">
                    Ажлын байр
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-blue-400 transition">
                    Сувилагчдад
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Тусламж</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="hover:text-blue-400 transition">
                    Холбоо барих
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-blue-400 transition">
                    Түгээмэл асуулт
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-blue-400 transition">
                    Нууцлал
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
            <p>&copy; 2025 PariwarCare. Turning remittance into remembrance.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
