import React from 'react';

export const Stats: React.FC = () => {
  const stats = [
    { value: '100+', label: 'Active Referees' },
    { value: '500+', label: 'Matches Officiated' },
    { value: '95%', label: 'Appointment Acceptance' },
    { value: '24/7', label: 'Platform Access' }
  ];

  return (
    <div className="bg-emerald-900 text-white py-16">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, idx) => (
            <div key={idx} className="text-center">
              <div className="text-5xl font-bold text-amber-400 mb-2">{stat.value}</div>
              <div className="text-lg text-gray-300">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
