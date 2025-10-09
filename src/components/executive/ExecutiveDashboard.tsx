import React, { useState } from 'react';
import { StatCard } from '../ui/Card';
import { AppointmentForm } from './AppointmentForm';
import { AppointmentsList } from './AppointmentsList';
import { RefereeManagement } from './RefereeManagement';
import { ReportsView } from './ReportsView';
import { ResultsView } from './ResultsView';
import { Appointment } from '../../types';

export const ExecutiveDashboard: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'appointments' | 'referees' | 'reports' | 'results'>('appointments');

  const handleCreateAppointment = (appointment: Appointment) => {
    setAppointments([...appointments, appointment]);
    setShowForm(false);
  };

  const stats = {
    total: appointments.length,
    pending: appointments.filter(a => a.status === 'pending').length,
    accepted: appointments.filter(a => a.status === 'accepted').length,
    rejected: appointments.filter(a => a.status === 'rejected').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-900">Executive Command Center</h2>
        {activeTab === 'appointments' && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-emerald-700 hover:bg-emerald-800 text-white px-6 py-2 rounded-lg font-semibold"
          >
            {showForm ? 'Cancel' : '+ New Appointment'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total Appointments" value={stats.total} icon="📋" color="emerald" />
        <StatCard title="Pending" value={stats.pending} icon="⏳" color="amber" />
        <StatCard title="Accepted" value={stats.accepted} icon="✅" color="green" />
        <StatCard title="Active Referees" value="12" icon="👥" color="blue" />
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('appointments')}
          className={`px-6 py-3 font-semibold ${activeTab === 'appointments' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-gray-600'}`}
        >
          Appointments
        </button>
        <button
          onClick={() => setActiveTab('referees')}
          className={`px-6 py-3 font-semibold ${activeTab === 'referees' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-gray-600'}`}
        >
          Referees
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-6 py-3 font-semibold ${activeTab === 'reports' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-gray-600'}`}
        >
          Reports
        </button>
        <button
          onClick={() => setActiveTab('results')}
          className={`px-6 py-3 font-semibold ${activeTab === 'results' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-gray-600'}`}
        >
          Results
        </button>
      </div>

      {activeTab === 'appointments' && (
        <>
          {showForm && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4 text-gray-900">Create New Appointment</h3>
              <AppointmentForm onSubmit={handleCreateAppointment} />
            </div>
          )}
          <AppointmentsList appointments={appointments} />
        </>
      )}

      {activeTab === 'referees' && <RefereeManagement />}
      {activeTab === 'reports' && <ReportsView />}
      {activeTab === 'results' && <ResultsView />}  {/* ✅ new tab */}
    </div>
  );
};
