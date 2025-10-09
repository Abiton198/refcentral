import React from 'react';
import { Appointment } from '../../types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

interface AppointmentsListProps {
  appointments: Appointment[];
}

export const AppointmentsList: React.FC<AppointmentsListProps> = ({ appointments }) => {
  const getStatusVariant = (status: string) => {
    switch(status) {
      case 'accepted': return 'success';
      case 'rejected': return 'danger';
      default: return 'warning';
    }
  };

  return (
    <div className="space-y-4">
      {appointments.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No appointments yet</p>
      ) : (
        appointments.map(apt => (
          <Card key={apt.id} className="hover:border-emerald-500 border-2 border-transparent">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-bold text-gray-900">
                    {apt.homeTeam} vs {apt.awayTeam}
                  </h3>
                  <Badge variant={getStatusVariant(apt.status)}>
                    {apt.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                  <p>📅 {apt.date} at {apt.time}</p>
                  <p>📍 {apt.venue}</p>
                  <p>🎽 Main: {apt.mainReferee}</p>
                  {apt.firstReserve && <p>🔄 Reserve: {apt.firstReserve}</p>}
                </div>
              </div>
              <Badge variant="info" size="sm">{apt.gameType}</Badge>
            </div>
          </Card>
        ))
      )}
    </div>
  );
};
