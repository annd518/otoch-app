"use client"

export const NurseStats = () => {
  const stats = {
    todayVisits: {
      total: 8,
      completed: 3,
      pending: 5,
    },
    weeklyStats: {
      totalVisits: 42,
      avgDuration: "38 мин",
      satisfactionRate: "4.8/5",
    },
    tasks: {
      reportsPending: 3,
      medicationReminders: 2,
      followUps: 4,
    },
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {/* Today's Visits - Emphasized with border */}
      <div className="bg-white rounded-lg border-l-4 border-blue-500 p-5 shadow-sm hover:shadow-md transition-shadow">
        <p className="text-sm text-gray-600 mb-1">Өнөөдрийн үзлэг</p>
        <p className="text-3xl font-bold text-gray-900 mb-2">{stats.todayVisits.total}</p>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-green-600 font-medium">✓ {stats.todayVisits.completed} done</span>
          <span className="text-amber-600 font-medium">{stats.todayVisits.pending} pending</span>
        </div>
      </div>

      {/* Average Duration - Simple with icon */}
      <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-700">Дундаж хугацаа</p>
        </div>
        <p className="text-3xl font-bold text-purple-600">{stats.weeklyStats.avgDuration}</p>
        <p className="text-xs text-gray-500 mt-1">Энэ долоо хоногт нэг үзлэгт</p>
      </div>

      {/* Patient Satisfaction - Rating style */}
      <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg p-5 shadow-sm border border-yellow-100 hover:shadow-md transition-shadow">
        <p className="text-sm font-medium text-gray-700 mb-2">Өвчтөний сэтгэл ханамж</p>
        <div className="flex items-baseline gap-2 mb-2">
          <p className="text-3xl font-bold text-gray-900">{stats.weeklyStats.satisfactionRate}</p>
          <div className="flex text-yellow-500">
            {[...Array(5)].map((_, i) => (
              <svg key={i} className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-600">35 үнэлгээнд үндэслэв</p>
      </div>

      {/* Pending Tasks - List style */}
      <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
        <p className="text-sm text-gray-600 mb-3">Хүлээгдэж буй ажил</p>
        <p className="text-4xl font-bold text-gray-900 mb-3">
          {stats.tasks.reportsPending + stats.tasks.medicationReminders}
        </p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Тайлан</span>
            <span className="font-medium text-gray-900">{stats.tasks.reportsPending}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Сануулга</span>
            <span className="font-medium text-gray-900">{stats.tasks.medicationReminders}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
