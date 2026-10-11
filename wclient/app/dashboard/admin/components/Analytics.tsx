import React from 'react';

type StatCardProps = {
  title: string;
  value: string | number;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
};

function StatCard({ title, value, trend, className = '' }: StatCardProps) {
  return (
    <div className={`p-6 bg-white/80 backdrop-blur-sm rounded-xl shadow-md border border-gray-200/50 hover:shadow-lg transition-all ${className}`}>
      <h3 className="text-gray-600 text-sm font-medium mb-2">{title}</h3>
      <p className="text-3xl font-bold text-gray-800 mb-1">{value}</p>
      {trend && (
        <p className={`text-sm font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% өмнөх сартай харьцуулахад
        </p>
      )}
    </div>
  );
}

type ChartData = {
  label: string;
  value: number;
};

function BarChart({ data }: { data: ChartData[] }) {
  const maxValue = Math.max(...data.map(d => d.value));

  return (
    <div className="flex items-end h-64 gap-3 px-4 py-6">
      {data.map((item, index) => (
        <div key={index} className="flex flex-col items-center flex-1 gap-2">
          <div className="w-full flex items-end justify-center relative group" style={{ height: '200px' }}>
            {/* Tooltip on hover */}
            <div className="absolute -top-8 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
              {item.value} visits
            </div>
            {/* Bar */}
            <div
              className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg shadow-lg hover:from-blue-700 hover:to-blue-500 transition-all duration-300 relative"
              style={{ height: `${(item.value / maxValue) * 100}%`, minHeight: '20px' }}
            >
              {/* Value label on bar */}
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-sm font-semibold text-gray-700">
                {item.value}
              </div>
            </div>
          </div>
          <span className="text-sm font-medium text-gray-600">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export const Analytics = () => {
  const visitTrend: ChartData[] = [
    { label: '6-р сар', value: 120 },
    { label: '7-р сар', value: 150 },
    { label: '8-р сар', value: 180 },
    { label: '9-р сар', value: 210 },
    { label: '10-р сар', value: 240 },
    { label: '11-р сар', value: 270 }
  ];

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Нийт хэрэглэгч"
          value="1,234"
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Идэвхтэй сувилагч"
          value="45"
          trend={{ value: 5, isPositive: true }}
        />
        <StatCard
          title="Сарын үзлэг"
          value="892"
          trend={{ value: 8, isPositive: true }}
        />
        <StatCard
          title="Батлагдахыг хүлээж буй"
          value="23"
          trend={{ value: 3, isPositive: false }}
        />
      </div>

      <div className="relative">
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg" />
        <div className="relative p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Сарын үзлэгийн хандлага</h3>
          <BarChart data={visitTrend} />
        </div>
      </div>
    </div>
  );
}