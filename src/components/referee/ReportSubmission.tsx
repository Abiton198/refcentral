import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface ReportSubmissionProps {
  onClose: () => void;
}

export const ReportSubmission: React.FC<ReportSubmissionProps> = ({ onClose }) => {
  const [reportType, setReportType] = useState('incident');
  const [formData, setFormData] = useState({
    matchDate: '',
    teams: '',
    venue: '',
    details: '',
    playerName: '',
    cardType: '',
    minute: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Report submitted successfully!');
    onClose();
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-bold text-gray-900">Submit Report</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <select
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
          className="w-full border rounded-lg px-4 py-2 font-semibold"
        >
          <option value="incident">Incident Report</option>
          <option value="redCard">Red Card Report</option>
          <option value="result">Match Result</option>
        </select>

        <input
          type="date"
          value={formData.matchDate}
          onChange={(e) => setFormData({...formData, matchDate: e.target.value})}
          className="w-full border rounded-lg px-4 py-2"
          placeholder="Match Date"
          required
        />

        <input
          type="text"
          value={formData.teams}
          onChange={(e) => setFormData({...formData, teams: e.target.value})}
          className="w-full border rounded-lg px-4 py-2"
          placeholder="Teams (e.g., Team A vs Team B)"
          required
        />

        <input
          type="text"
          value={formData.venue}
          onChange={(e) => setFormData({...formData, venue: e.target.value})}
          className="w-full border rounded-lg px-4 py-2"
          placeholder="Venue"
          required
        />

        {reportType === 'redCard' && (
          <>
            <input
              type="text"
              value={formData.playerName}
              onChange={(e) => setFormData({...formData, playerName: e.target.value})}
              className="w-full border rounded-lg px-4 py-2"
              placeholder="Player Name"
              required
            />
            <input
              type="number"
              value={formData.minute}
              onChange={(e) => setFormData({...formData, minute: e.target.value})}
              className="w-full border rounded-lg px-4 py-2"
              placeholder="Minute"
              required
            />
          </>
        )}

        <textarea
          value={formData.details}
          onChange={(e) => setFormData({...formData, details: e.target.value})}
          className="w-full border rounded-lg px-4 py-2 h-32"
          placeholder="Report details..."
          required
        />

        <div className="flex gap-3">
          <Button type="submit" className="flex-1">Submit Report</Button>
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
        </div>
      </form>
    </Card>
  );
};
