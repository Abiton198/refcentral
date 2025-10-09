export type UserRole = 'executive' | 'referee' | 'coach';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'suspended';
}

export interface Appointment {
  id: string;
  date: string;
  time: string;
  homeTeam: string;
  awayTeam: string;
  venue: string;
  mainReferee: string;
  firstReserve?: string;
  secondTeam?: string;
  status: 'pending' | 'accepted' | 'rejected';
  gameType: 'league' | 'cup' | 'friendly';
}

export interface Report {
  id: string;
  appointmentId: string;
  type: 'incident' | 'redCard' | 'result';
  submittedBy: string;
  submittedAt: string;
  content: string;
  details: any;
}
