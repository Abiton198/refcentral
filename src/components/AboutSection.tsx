import React from 'react';
import { Card } from './ui/Card';

export const AboutSection: React.FC = () => {
  return (
    <div className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <img 
              src="/img/executive.jpeg"
              alt="EPRRS EXECO"
              className="rounded-2xl shadow-2xl"
              width='500px'
            />
          </div>
          
          <div>
            <h2 className="text-4xl font-bold text-gray-900 mb-6">
              Leading Rugby Officiating into the Digital Age
            </h2>
            <p className="text-lg text-gray-700 mb-4">
              RefCentral represents the evolution of rugby referee management in Eastern Province Rugby Referees Society. Built by officials, 
              for officials, our platform combines decades of rugby tradition with cutting-edge technology.
            </p>
            <p className="text-lg text-gray-700 mb-6">
              From appointment scheduling to comprehensive reporting, we've digitized every aspect 
              of referee administration while maintaining the integrity and authority that defines rugby officiating in Eastern Province Rugby Union.
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <Card className="text-center">
                <div className="text-3xl font-bold text-emerald-700 mb-1">5+</div>
                <div className="text-sm text-gray-600">Years Experience</div>
              </Card>
              <Card className="text-center">
                <div className="text-3xl font-bold text-emerald-700 mb-1">100%</div>
                <div className="text-sm text-gray-600">Digital Coverage</div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
