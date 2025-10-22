import React, { useEffect, useState } from 'react';
import { Card, StatCard } from '../ui/Card';
import { Button } from '../ui/Button';
import { db } from '../../lib/firebase';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export const CoachDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'reports' | 'profile'>('reports');
  const [showForm, setShowForm] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    matchDate: '',
    homeTeam: '',
    awayTeam: '',
    reportType: 'performance',
    content: '',
    playerName: '',
    minute: '',
    lawInfringed: '',
    subject: '',
  });

  const auth = getAuth();
  const user = auth.currentUser;
  const coachName = user?.displayName || 'Coach';
  const coachEmail = user?.email || 'unknown@example.com';

  // ✅ Load coach profile
  useEffect(() => {
    if (!user?.uid) return;
    const fetchProfile = async () => {
      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        setProfile(snap.data());
      }
    };
    fetchProfile();
  }, [user?.uid]);

  // ✅ Fetch coach reports in real-time
  useEffect(() => {
    if (!coachEmail) return;
    const q = query(collection(db, 'coachReports'), where('coachEmail', '==', coachEmail));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setReports(data);
      setLoading(false);
    });
    return () => unsub();
  }, [coachEmail]);

  // ✅ Submit a new report to Firestore
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'coachReports'), {
        coachName,
        coachEmail,
        matchDate: formData.matchDate,
        homeTeam: formData.homeTeam,
        awayTeam: formData.awayTeam,
        reportType: formData.reportType,
        content: formData.content,
        playerName: formData.reportType === 'redCard' ? formData.playerName : '',
        minute: formData.reportType === 'redCard' ? formData.minute : '',
        lawInfringed: formData.reportType === 'redCard' ? formData.lawInfringed : '',
        subject: formData.reportType === 'custom' ? formData.subject : '',
        createdAt: serverTimestamp(),
      });

      alert('✅ Report submitted successfully!');
      setShowForm(false);
      setFormData({
        matchDate: '',
        homeTeam: '',
        awayTeam: '',
        reportType: 'performance',
        content: '',
        playerName: '',
        minute: '',
        lawInfringed: '',
        subject: '',
      });
    } catch (error) {
      console.error('Error submitting report:', error);
      alert('❌ Failed to submit report. Try again.');
    }
  };

  // ✅ Common Rugby Laws for red card report
  const rugbyLaws = [
    { number: 'Law 9.11', title: 'Players must not do anything reckless or dangerous to others' },
    { number: 'Law 9.12', title: 'No physical or verbal abuse' },
    { number: 'Law 9.13', title: 'Dangerous tackle of an opponent' },
    { number: 'Law 9.16', title: 'Charging without attempting to grasp' },
    { number: 'Law 9.17', title: 'Tackling a player in the air' },
    { number: 'Law 9.20', title: 'Dangerous play in a ruck or maul' },
    { number: 'Law 9.25', title: 'Unsporting conduct' },
    { number: 'Law 9.28', title: 'Repeated infringements' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-900">Welcome, {coachName}</h2>
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'reports' ? 'default' : 'secondary'}
            onClick={() => setActiveTab('reports')}
          >
            Reports
          </Button>
          <Button
            variant={activeTab === 'profile' ? 'default' : 'secondary'}
            onClick={() => setActiveTab('profile')}
          >
            Profile
          </Button>
        </div>
      </div>

      {activeTab === 'profile' ? (
        // ✅ Profile Tab
        <Card>
          <h3 className="text-2xl font-bold mb-4">Coach Profile</h3>
          {profile ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700">
              <p><strong>Name:</strong> {profile.name} {profile.surname}</p>
              <p><strong>Club:</strong> {profile.club}</p>
              <p><strong>Contact:</strong> {profile.contact}</p>
              <p><strong>Gender:</strong> {profile.gender}</p>
              <p><strong>Role in Club:</strong> {profile.roleInClub}</p>
              <p><strong>Email:</strong> {coachEmail}</p>
              <p><strong>Status:</strong> {profile.approved ? '✅ Approved' : '⏳ Pending Approval'}</p>
            </div>
          ) : (
            <p className="text-gray-500">Loading profile...</p>
          )}
        </Card>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard title="Reports Submitted" value={reports.length} icon="📝" color="emerald" />
            <StatCard title="This Month" value="3" icon="📅" color="amber" />
            <StatCard title="Pending Review" value="1" icon="⏳" color="blue" />
          </div>

          {/* Report Form */}
          {showForm ? (
            <Card>
              <h3 className="text-xl font-bold mb-4">Submit Match Report</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="date"
                  value={formData.matchDate}
                  onChange={(e) => setFormData({ ...formData, matchDate: e.target.value })}
                  className="w-full border rounded-lg px-4 py-2"
                  required
                />

                <input
                  type="text"
                  placeholder="Home Team"
                  value={formData.homeTeam}
                  onChange={(e) => setFormData({ ...formData, homeTeam: e.target.value })}
                  className="w-full border rounded-lg px-4 py-2"
                  required
                />

                <input
                  type="text"
                  placeholder="Away Team"
                  value={formData.awayTeam}
                  onChange={(e) => setFormData({ ...formData, awayTeam: e.target.value })}
                  className="w-full border rounded-lg px-4 py-2"
                  required
                />

                <select
                  value={formData.reportType}
                  onChange={(e) => setFormData({ ...formData, reportType: e.target.value })}
                  className="w-full border rounded-lg px-4 py-2"
                >
                  <option value="performance">Performance Feedback</option>
                  <option value="incident">Incident Report</option>
                  <option value="redCard">Red Card Report</option>
                  <option value="custom">Custom Report</option>
                </select>

                {formData.reportType === 'redCard' && (
                  <>
                    <input
                      type="text"
                      placeholder="Player Name"
                      value={formData.playerName}
                      onChange={(e) => setFormData({ ...formData, playerName: e.target.value })}
                      className="w-full border rounded-lg px-4 py-2"
                      required
                    />
                    <input
                      type="number"
                      placeholder="Minute of Offense"
                      value={formData.minute}
                      onChange={(e) => setFormData({ ...formData, minute: e.target.value })}
                      className="w-full border rounded-lg px-4 py-2"
                      required
                    />
                    <select
                      value={formData.lawInfringed}
                      onChange={(e) => setFormData({ ...formData, lawInfringed: e.target.value })}
                      className="w-full border rounded-lg px-4 py-2"
                      required
                    >
                      <option value="">Select Law of Rugby Infringed</option>
                      {rugbyLaws.map((law) => (
                        <option key={law.number} value={law.number}>
                          {law.number} — {law.title}
                        </option>
                      ))}
                    </select>
                  </>
                )}

                {formData.reportType === 'custom' && (
                  <input
                    type="text"
                    placeholder="Report Subject / Topic"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                    required
                  />
                )}

                <textarea
                  placeholder="Report details..."
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full border rounded-lg px-4 py-2 h-32"
                  required
                />

                <Button type="submit" className="w-full">Submit Report</Button>
              </form>
            </Card>
          ) : (
            <Button onClick={() => setShowForm(true)}>+ Submit Report</Button>
          )}

          {/* Reports List */}
          <div>
            <h3 className="text-2xl font-bold mb-4">Your Reports</h3>
            {loading ? (
              <Card><p className="text-center text-gray-500">Loading reports...</p></Card>
            ) : reports.length === 0 ? (
              <Card><p className="text-center text-gray-500">No reports submitted yet</p></Card>
            ) : (
              <div className="space-y-4">
                {reports.map((report) => (
                  <Card key={report.id}>
                    <h4 className="font-bold text-gray-900">
                      {report.homeTeam} vs {report.awayTeam}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {report.matchDate} • {report.reportType}
                    </p>
                    {report.reportType === 'redCard' && (
                      <p className="text-sm text-red-600 mt-1">
                        🟥 {report.playerName} — {report.lawInfringed} (Minute {report.minute})
                      </p>
                    )}
                    {report.reportType === 'custom' && (
                      <p className="font-semibold text-gray-800">📝 {report.subject}</p>
                    )}
                    <p className="mt-2 text-gray-700">{report.content}</p>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
