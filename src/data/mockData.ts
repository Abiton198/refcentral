import { User, Appointment, Report } from '../types';

export const mockReferees: User[] = [
  { id: 'r1', name: 'Aphiwe Mfana', email: 'aphiwe@gmail.com', role: 'referee', status: 'active' },
  { id: 'r2', name: 'Luxolo Booi', email: 'luxolo@gmail.com', role: 'referee', status: 'active' },
  { id: 'r3', name: 'Ampie Swart', email: 'ampie@gmail.com', role: 'referee', status: 'active' },
  { id: 'r4', name: 'Emile Adams', email: 'emile@gmail.com', role: 'referee', status: 'active' },
];

export const mockTeams = [
  'Parks', 'Progress', 'NMU', 'Gardens', 'Partensie', 'Harlequeins', 
  'Brumbies', 'Trying Stars', 'Star of Hope', 'KruisFontein'
];

export const mockVenues = [
  'Parks', 'NMU Stadium', 'Rhodes Uni', 'Kruisfontein', 
  'Adcock Stadium', 'Central Stadium'
];
