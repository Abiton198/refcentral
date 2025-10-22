import React, { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Input } from '../ui/Input'; // Assuming you have a styled input component
import { Select } from '../ui/Select'; // Or replace with <select> if you prefer plain HTML

interface Report {
  id: string;
  type: string;
  submittedBy: string;
  match: string;
  date: string;
  status: string;
}

export const ReportsView: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // ✅ Fetch both referee & coach reports in real time
  useEffect(() => {
    const refReportsQuery = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    const coachReportsQuery = query(collection(db, 'coachReports'), orderBy('createdAt', 'desc'));

    const unsubRef = onSnapshot(refReportsQuery, (snapshot) => {
      const refs = snapshot.docs.map((doc) => ({
        id: doc.id,
        type: doc.data().type || 'incident',
        submittedBy: doc.data().refereeName || 'Unknown Referee',
        match: doc.data().teams || 'N/A',
        date: doc.data().matchDate || '',
        status: doc.data().reviewStatus || 'pending',
      }));
      setReports((prev) => {
        const coachesOnly = prev.filter((r) => r.submittedBy?.startsWith('Coach'));
        return [...coachesOnly, ...refs];
      });
    });

    const unsubCoach = onSnapshot(coachReportsQuery, (snapshot) => {
      const coaches = snapshot.docs.map((doc) => ({
        id: doc.id,
        type: doc.data().reportType || 'performance',
        submittedBy: doc.data().coachName || 'Unknown Coach',
        match: `${doc.data().homeTeam || ''} vs ${doc.data().awayTeam || ''}`.trim(),
        date: doc.data().matchDate || '',
        status: doc.data().reviewStatus || 'pending',
      }));
      setReports((prev) => {
        const refsOnly = prev.filter((r) => !r.submittedBy?.startsWith('Coach'));
        return [...refsOnly, ...coaches];
      });
    });

    return () => {
      unsubRef();
      unsubCoach();
    };
  }, []);

  // ✅ Apply filters & search
  useEffect(() => {
    let filtered = reports;

    if (filterType !== 'all') {
      filtered = filtered.filter((r) => r.type.toLowerCase() === filterType.toLowerCase());
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((r) => r.status.toLowerCase() === filterStatus.toLowerCase());
    }

    if (searchTerm.trim() !== '') {
      filtered = filtered.filter(
        (r) =>
          r.submittedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.match.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredReports(filtered);
  }, [searchTerm, filterType, filterStatus, reports]);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'incident':
        return 'warning';
      case 'redCard':
        return 'danger';
      case 'result':
        return 'info';
      case 'performance':
        return 'success';
      case 'custom':
        return 'purple';
      default:
        return 'info';
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-2xl font-bold text-gray-900">Reports Repository</h3>

      {/* 🔍 Search & Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-center">
        <input
          type="text"
          placeholder="Search by name or match..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:w-1/3 border rounded-lg px-4 py-2"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="w-full md:w-1/4 border rounded-lg px-4 py-2"
        >
          <option value="all">All Types</option>
          <option value="incident">Incident</option>
          <option value="redCard">Red Card</option>
          <option value="result">Result</option>
          <option value="performance">Performance</option>
          <option value="custom">Custom</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="w-full md:w-1/4 border rounded-lg px-4 py-2"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="reviewed">Reviewed</option>
        </select>
      </div>

      {/* 🧾 Report Cards */}
      <div className="space-y-3">
        {filteredReports.length === 0 ? (
          <Card>
            <p className="text-center text-gray-500 py-6">No reports found.</p>
          </Card>
        ) : (
          filteredReports.map((report) => (
            <Card
              key={report.id}
              className="hover:border-emerald-500 border-2 border-transparent cursor-pointer transition-all"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant={getTypeColor(report.type) as any}>
                      {report.type.toUpperCase()}
                    </Badge>
                    <h4 className="font-bold text-gray-900">{report.match}</h4>
                  </div>
                  <p className="text-sm text-gray-600">
                    Submitted by: {report.submittedBy}
                  </p>
                  <p className="text-sm text-gray-600">Date: {report.date}</p>
                </div>
                <Badge
                  variant={report.status === 'reviewed' ? 'success' : 'warning'}
                >
                  {report.status}
                </Badge>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
