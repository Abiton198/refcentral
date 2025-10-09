import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { mockReferees } from '../../data/mockData';

export const RefereeManagement: React.FC = () => {
  const [referees, setReferees] = useState(mockReferees);

  const handleSuspend = (id: string) => {
    const reason = prompt('Enter suspension reason:');
    if (reason) {
      setReferees(referees.map(ref => 
        ref.id === id ? { ...ref, status: 'suspended' as const } : ref
      ));
      alert(`Referee suspended. Reason: ${reason}`);
    }
  };

  const handleActivate = (id: string) => {
    setReferees(referees.map(ref => 
      ref.id === id ? { ...ref, status: 'active' as const } : ref
    ));
  };

  return (
    <div className="space-y-4">
      <h3 className="text-2xl font-bold text-gray-900">Referee Management</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {referees.map(ref => (
          <Card key={ref.id}>
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-lg font-bold text-gray-900">{ref.name}</h4>
                <p className="text-sm text-gray-600">{ref.email}</p>
                <div className="mt-2">
                  <Badge variant={ref.status === 'active' ? 'success' : 'danger'}>
                    {ref.status.toUpperCase()}
                  </Badge>
                </div>
              </div>
              <div>
                {ref.status === 'active' ? (
                  <Button size="sm" variant="danger" onClick={() => handleSuspend(ref.id)}>
                    Suspend
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => handleActivate(ref.id)}>
                    Activate
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
