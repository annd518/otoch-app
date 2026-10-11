export const AdminStats = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {/* Pending Reviews - Emphasis with warning style */}
      <div className="bg-white rounded-lg border-l-4 border-amber-500 p-5 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Хянагдахыг хүлээж буй</p>
            <p className="text-3xl font-bold text-gray-900">8</p>
            <p className="text-xs text-amber-600 mt-2">Таны баталгаажуулалтыг хүлээж байна</p>
          </div>
          <div className="bg-amber-100 p-3 rounded-lg">
            <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Approved Today - Success with subtle background */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-5 shadow-sm border border-green-100 hover:shadow-md transition-shadow">
        <div className="flex items-start gap-3">
          <div className="bg-green-600 p-2.5 rounded-md">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700">Өнөөдөр батлагдсан</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">12</p>
            <p className="text-xs text-gray-600 mt-1.5">Баталгаажсан тайлан</p>
          </div>
        </div>
      </div>

      {/* Rejected Reports - Minimal count */}
      <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
        <p className="text-sm text-gray-600 mb-3">Татгалзсан тайлан</p>
        <div className="flex items-baseline gap-2">
          <p className="text-4xl font-bold text-red-600">2</p>
          <p className="text-sm text-gray-500">сүүлийн 24 цагт</p>
        </div>
        <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-red-500 rounded-full" style={{ width: '15%' }}></div>
        </div>
      </div>

      {/* Average Review Time - Clean metric */}
      <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-700">Дундаж хянах хугацаа</p>
        </div>
        <p className="text-3xl font-bold text-blue-600">15 мин</p>
        <p className="text-xs text-gray-500 mt-1">Тайлан бүрт</p>
      </div>
    </div>
  );
}