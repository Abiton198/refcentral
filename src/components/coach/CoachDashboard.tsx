import React, { useState } from 'react';
import { Card, StatCard } from '../ui/Card';
import { Button } from '../ui/Button';

export const CoachDashboard: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    matchDate: '',
    homeTeam: '',
    awayTeam: '',
    reportType: 'performance',
    content: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setReports([...reports, { ...formData, id: Date.now().toString(), submittedAt: new Date().toISOString() }]);
    setFormData({ matchDate: '', homeTeam: '', awayTeam: '', reportType: 'performance', content: '' });
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-900">Coach Portal</h2>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Submit Report'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Reports Submitted" value={reports.length} icon="📝" color="emerald" />
        <StatCard title="This Month" value="3" icon="📅" color="amber" />
        <StatCard title="Pending Review" value="1" icon="⏳" color="blue" />
      </div>

      {showForm && (
        <Card>
          <h3 className="text-xl font-bold mb-4">Submit Match Report</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="date"
              value={formData.matchDate}
              onChange={(e) => setFormData({...formData, matchDate: e.target.value})}
              className="w-full border rounded-lg px-4 py-2"
              required
            />
            <input
              type="text"
              placeholder="Home Team"
              value={formData.homeTeam}
              onChange={(e) => setFormData({...formData, homeTeam: e.target.value})}
              className="w-full border rounded-lg px-4 py-2"
              required
            />
            <input
              type="text"
              placeholder="Away Team"
              value={formData.awayTeam}
              onChange={(e) => setFormData({...formData, awayTeam: e.target.value})}
              className="w-full border rounded-lg px-4 py-2"
              required
            />
            <select
              value={formData.reportType}
              onChange={(e) => setFormData({...formData, reportType: e.target.value})}
              className="w-full border rounded-lg px-4 py-2"
            >
              <option value="performance">Performance Feedback</option>
              <option value="incident">Incident Report</option>
              <option value="redCard">Red Card Report</option>
            </select>
            <textarea
              placeholder="Report details..."
              value={formData.content}
              onChange={(e) => setFormData({...formData, content: e.target.value})}
              className="w-full border rounded-lg px-4 py-2 h-32"
              required
            />
            <Button type="submit" className="w-full">Submit Report</Button>
          </form>
        </Card>
      )}

      <div>
        <h3 className="text-2xl font-bold mb-4">Your Reports</h3>
        {reports.length === 0 ? (
          <Card><p className="text-center text-gray-500">No reports submitted yet</p></Card>
        ) : (
          <div className="space-y-4">
            {reports.map(report => (
              <Card key={report.id}>
                <h4 className="font-bold">{report.homeTeam} vs {report.awayTeam}</h4>
                <p className="text-sm text-gray-600">{report.matchDate} • {report.reportType}</p>
                <p className="mt-2 text-gray-700">{report.content}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
