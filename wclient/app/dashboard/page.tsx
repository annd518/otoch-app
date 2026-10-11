import Link from 'next/link';

const DashboardCard = ({ title, description, href }: {
  title: string;
  description: string;
  href: string;
}) => (
  <Link
    href={href}
    className="block p-6 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
  >
    <h3 className="text-lg font-semibold mb-2">{title}</h3>
    <p className="text-gray-600">{description}</p>
  </Link>
);

export default function DashboardPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-8">Эрүүл мэндийн хянах самбарт тавтай морил</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <DashboardCard
          title="Сувилагчийн самбар"
          description="Томилогдсон үзлэгүүдээ харж, амин үзүүлэлт илгээн, өвчтөний асаргааг удирдах."
          href="/dashboard/nurse"
        />
        <DashboardCard
          title="Эмнэлгийн админы самбар"
          description="Тайлан хянаж батлах, эмнэлгийн бүртгэл удирдах, асаргааны чанарыг хянах."
          href="/dashboard/medical-admin"
        />
        <DashboardCard
          title="Админы самбар"
          description="Хэрэглэгч удирдах, сувилагч томилох, платформын статистик харах."
          href="/dashboard/admin"
        />
      </div>
    </div>
  );
}