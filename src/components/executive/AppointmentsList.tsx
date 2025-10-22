import React, { useEffect, useState, useMemo } from "react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";

interface Appointment {
  id: string;
  date: string;
  time: string;
  homeTeam: string;
  awayTeam: string;
  venue: string;
  mainReferee: string;
  firstReserve?: string;
  gameType: string;
  status: string;
  createdAt?: any;
}

export const AppointmentsList: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchTeam, setSearchTeam] = useState("");
  const [searchRef, setSearchRef] = useState("");
  const [filterDate, setFilterDate] = useState("");

  // ✅ Real-time Firestore listener for all appointments
  useEffect(() => {
    const q = query(collection(db, "appointments"), orderBy("date", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Appointment[];
      setAppointments(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ✅ Derived filtered list using useMemo (efficient filtering)
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      const matchDate = filterDate ? apt.date === filterDate : true;
      const matchTeam =
        searchTeam.trim() === "" ||
        apt.homeTeam.toLowerCase().includes(searchTeam.toLowerCase()) ||
        apt.awayTeam.toLowerCase().includes(searchTeam.toLowerCase());
      const matchRef =
        searchRef.trim() === "" ||
        apt.mainReferee.toLowerCase().includes(searchRef.toLowerCase()) ||
        (apt.firstReserve &&
          apt.firstReserve.toLowerCase().includes(searchRef.toLowerCase()));

      return matchDate && matchTeam && matchRef;
    });
  }, [appointments, filterDate, searchTeam, searchRef]);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "accepted":
        return "success";
      case "rejected":
        return "danger";
      case "completed":
        return "info";
      case "pending":
      default:
        return "warning";
    }
  };

  const resetFilters = () => {
    setSearchTeam("");
    setSearchRef("");
    setFilterDate("");
  };

  return (
    <div className="space-y-6">
      {/* 🔍 Search & Filters */}
      <div className="flex flex-col md:flex-row flex-wrap gap-4 items-end">
        <div className="flex flex-col space-y-1 w-full md:w-1/3">
          <label className="text-sm font-semibold text-gray-600">
            Filter by Team
          </label>
          <input
            type="text"
            placeholder="Search by home or away team..."
            value={searchTeam}
            onChange={(e) => setSearchTeam(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2"
          />
        </div>

        <div className="flex flex-col space-y-1 w-full md:w-1/3">
          <label className="text-sm font-semibold text-gray-600">
            Filter by Referee
          </label>
          <input
            type="text"
            placeholder="Enter referee or reserve name..."
            value={searchRef}
            onChange={(e) => setSearchRef(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2"
          />
        </div>

        <div className="flex flex-col space-y-1 w-full md:w-1/4">
          <label className="text-sm font-semibold text-gray-600">
            Filter by Date
          </label>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2"
          />
        </div>

        <Button
          variant="outline"
          onClick={resetFilters}
          className="h-10 mt-1 md:mt-0"
        >
          🔄 Reset
        </Button>
      </div>

      {/* 📅 Appointment List */}
      <div className="space-y-4">
        {loading ? (
          <p className="text-center text-gray-500 py-8 animate-pulse">
            Loading appointments...
          </p>
        ) : filteredAppointments.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            No appointments found.
          </p>
        ) : (
          filteredAppointments.map((apt) => (
            <Card
              key={apt.id}
              className="hover:border-emerald-500 border-2 border-transparent transition-all cursor-pointer"
            >
              <div className="flex justify-between items-start">
                {/* Left Section */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-gray-900">
                      {apt.homeTeam} vs {apt.awayTeam}
                    </h3>
                    <Badge variant={getStatusVariant(apt.status)}>
                      {apt.status.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                    <p>
                      📅 {apt.date} • ⏰ {apt.time}
                    </p>
                    <p>📍 {apt.venue}</p>
                    <p>🎽 Main Referee: {apt.mainReferee}</p>
                    {apt.firstReserve && <p>🔄 Reserve: {apt.firstReserve}</p>}
                  </div>
                </div>

                {/* Right Section */}
                <Badge variant="info" size="sm">
                  {apt.gameType}
                </Badge>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
