import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

export const ReportsView: React.FC = () => {
  const [reports] = useState([
    {
      id: '1',
      type: 'incident',
      submittedBy: 'John Smith',
      match: 'Springboks vs Lions',
      date: '2025-10-10',
      status: 'reviewed'
    },
    {
      id: '2',
      type: 'redCard',
      submittedBy: 'Sarah Jones',
      match: 'Bulls vs Sharks',
      date: '2025-10-08',
      status: 'pending'
    },
    {
      id: '3',
      type: 'result',
      submittedBy: 'Mike Brown',
      match: 'Stormers vs Cheetahs',
      date: '2025-10-05',
      status: 'reviewed'
    }
  ]);

  const getTypeColor = (type: string) => {
    switch(type) {
      case 'incident': return 'warning';
      case 'redCard': return 'danger';
      case 'result': return 'info';
      default: return 'info';
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-2xl font-bold text-gray-900">Reports Repository</h3>
      
      <div className="space-y-3">
        {reports.map(report => (
          <Card key={report.id} className="hover:border-emerald-500 border-2 border-transparent cursor-pointer">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Badge variant={getTypeColor(report.type) as any}>
                    {report.type.toUpperCase()}
                  </Badge>
                  <h4 className="font-bold text-gray-900">{report.match}</h4>
                </div>
                <p className="text-sm text-gray-600">Submitted by: {report.submittedBy}</p>
                <p className="text-sm text-gray-600">Date: {report.date}</p>
              </div>
              <Badge variant={report.status === 'reviewed' ? 'success' : 'warning'}>
                {report.status}
              </Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
