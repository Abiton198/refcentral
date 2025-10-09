import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { mockReferees, mockTeams, mockVenues } from '../../data/mockData';

interface AppointmentFormProps {
  onSubmit: (appointment: any) => void;
}

export const AppointmentForm: React.FC<AppointmentFormProps> = ({ onSubmit }) => {
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    homeTeam: '',
    awayTeam: '',
    venue: '',
    mainReferee: '',
    firstReserve: '',
    gameType: 'league'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      id: Date.now().toString(),
      status: 'pending'
    });
    setFormData({
      date: '',
      time: '',
      homeTeam: '',
      awayTeam: '',
      venue: '',
      mainReferee: '',
      firstReserve: '',
      gameType: 'league'
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <input
          type="date"
          value={formData.date}
          onChange={(e) => setFormData({...formData, date: e.target.value})}
          className="border rounded-lg px-4 py-2"
          required
        />
        <input
          type="time"
          value={formData.time}
          onChange={(e) => setFormData({...formData, time: e.target.value})}
          className="border rounded-lg px-4 py-2"
          required
        />
      </div>
      
      <select
        value={formData.homeTeam}
        onChange={(e) => setFormData({...formData, homeTeam: e.target.value})}
        className="w-full border rounded-lg px-4 py-2"
        required
      >
        <option value="">Select Home Team</option>
        {mockTeams.map(team => <option key={team} value={team}>{team}</option>)}
      </select>

      <select
        value={formData.awayTeam}
        onChange={(e) => setFormData({...formData, awayTeam: e.target.value})}
        className="w-full border rounded-lg px-4 py-2"
        required
      >
        <option value="">Select Away Team</option>
        {mockTeams.map(team => <option key={team} value={team}>{team}</option>)}
      </select>

      <select
        value={formData.venue}
        onChange={(e) => setFormData({...formData, venue: e.target.value})}
        className="w-full border rounded-lg px-4 py-2"
        required
      >
        <option value="">Select Venue</option>
        {mockVenues.map(venue => <option key={venue} value={venue}>{venue}</option>)}
      </select>

      <select
        value={formData.mainReferee}
        onChange={(e) => setFormData({...formData, mainReferee: e.target.value})}
        className="w-full border rounded-lg px-4 py-2"
        required
      >
        <option value="">Select Main Referee</option>
        {mockReferees.map(ref => <option key={ref.id} value={ref.name}>{ref.name}</option>)}
      </select>

      <select
        value={formData.firstReserve}
        onChange={(e) => setFormData({...formData, firstReserve: e.target.value})}
        className="w-full border rounded-lg px-4 py-2"
      >
        <option value="">Select 1st Reserve</option>
        {mockReferees.map(ref => <option key={ref.id} value={ref.name}>{ref.name}</option>)}
      </select>

      <select
        value={formData.gameType}
        onChange={(e) => setFormData({...formData, gameType: e.target.value})}
        className="w-full border rounded-lg px-4 py-2"
      >
        <option value="league">League Match</option>
        <option value="cup">Cup Match</option>
        <option value="school">School Game</option>
        <option value="tournament">Tournament</option>
        <option value="friendly">Friendly</option>
      </select>

      <Button type="submit" className="w-full">Create Appointment</Button>
    </form>
  );
};
