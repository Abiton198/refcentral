import React from 'react';
import { Card } from './ui/Card';

export const Features: React.FC = () => {
  const features = [
    {
      icon: '📋',
      title: 'Smart Appointments',
      desc: 'Automated referee assignment with workload balancing and availability tracking'
    },
    {
      icon: '📊',
      title: 'Analytics Dashboard',
      desc: 'Real-time insights into referee performance, game coverage, and incident patterns'
    },
    {
      icon: '🔒',
      title: 'Secure Access',
      desc: 'Role-based permissions ensuring confidentiality and professional data protection'
    },
    {
      icon: '📱',
      title: 'Mobile Ready',
      desc: 'Accept appointments and submit reports from anywhere, anytime'
    },
    {
      icon: '📝',
      title: 'Digital Reports',
      desc: 'Standardized incident, red card, and match result reporting system'
    },
    {
      icon: '🏆',
      title: 'Career Tracking',
      desc: 'Build your professional portfolio with complete match history and evaluations'
    }
  ];

  return (
    <div className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Platform Features</h2>
          <p className="text-xl text-gray-600">Everything you need for professional referee management</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, idx) => (
            <Card key={idx} className="text-center hover:scale-105 transition-transform">
              <div className="text-5xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-600">{feature.desc}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
