import { User, Appointment, Report } from '../types';

export const mockReferees: User[] = [
  { id: 'r1', name: 'John Smith', email: 'john@ref.com', role: 'referee', status: 'active' },
  { id: 'r2', name: 'Sarah Jones', email: 'sarah@ref.com', role: 'referee', status: 'active' },
  { id: 'r3', name: 'Mike Brown', email: 'mike@ref.com', role: 'referee', status: 'active' },
  { id: 'r4', name: 'Lisa Wilson', email: 'lisa@ref.com', role: 'referee', status: 'active' },
];

export const mockTeams = [
  'Springboks', 'Lions', 'Bulls', 'Sharks', 'Stormers', 'Cheetahs', 
  'Blue Bulls', 'Golden Lions', 'Western Province', 'Free State'
];

export const mockVenues = [
  'Ellis Park', 'Loftus Versfeld', 'Kings Park', 'Newlands', 
  'Free State Stadium', 'Mbombela Stadium'
];
