import React, { useState } from 'react';
import { Card, StatCard } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ReportSubmission } from './ReportSubmission';

export const RefereeDashboard: React.FC = () => {
  const [showReportForm, setShowReportForm] = useState(false);
  const [appointments, setAppointments] = useState([
    {
      id: '1',
      date: '2025-10-15',
      time: '15:00',
      homeTeam: 'Springboks',
      awayTeam: 'Lions',
      venue: 'Ellis Park',
      status: 'pending'
    },
    {
      id: '2',
      date: '2025-10-20',
      time: '14:30',
      homeTeam: 'Bulls',
      awayTeam: 'Sharks',
      venue: 'Loftus Versfeld',
      status: 'pending'
    }
  ]);

  const handleResponse = (id: string, response: 'accepted' | 'rejected') => {
    setAppointments(appointments.map(apt => 
      apt.id === id ? { ...apt, status: response } : apt
    ));
  };

  const pending = appointments.filter(a => a.status === 'pending').length;
  const accepted = appointments.filter(a => a.status === 'accepted').length;

  if (showReportForm) {
    return <ReportSubmission onClose={() => setShowReportForm(false)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-900">Referee Portal</h2>
        <Button onClick={() => setShowReportForm(true)}>📝 Submit Report</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Pending Appointments" value={pending} icon="⏳" color="amber" />
        <StatCard title="Accepted" value={accepted} icon="✅" color="green" />
        <StatCard title="Career Matches" value="47" icon="🏆" color="emerald" />
      </div>

      <div>
        <h3 className="text-2xl font-bold mb-4 text-gray-900">Your Appointments</h3>
        <div className="space-y-4">
          {appointments.map(apt => (
            <Card key={apt.id}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold">{apt.homeTeam} vs {apt.awayTeam}</h3>
                    <Badge variant={apt.status === 'accepted' ? 'success' : apt.status === 'rejected' ? 'danger' : 'warning'}>
                      {apt.status.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-gray-600">📅 {apt.date} at {apt.time}</p>
                  <p className="text-gray-600">📍 {apt.venue}</p>
                </div>
                {apt.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleResponse(apt.id, 'accepted')}>Accept</Button>
                    <Button size="sm" variant="danger" onClick={() => handleResponse(apt.id, 'rejected')}>Decline</Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
