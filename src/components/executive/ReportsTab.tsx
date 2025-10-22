import React, { useEffect, useState, useMemo } from "react";
import { db } from "../../lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  doc,
} from "firebase/firestore";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";

interface Report {
  id: string;
  referee: string;
  refereeEmail: string;
  type: string;
  lawBroken?: string;
  description: string;
  date: string;
  createdAt?: any;
  reviewed?: boolean;
}

export const ReportsTab: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ Filters
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "reviewed">("all");
  const [filterRef, setFilterRef] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterType, setFilterType] = useState("");

  // ✅ Real-time listener for reports
  useEffect(() => {
    const q = query(collection(db, "reports"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Report[];
      setReports(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ✅ Mark as reviewed
  const handleMarkReviewed = async (id: string) => {
    try {
      await updateDoc(doc(db, "reports", id), { reviewed: true });
    } catch (err) {
      console.error("Error updating report:", err);
      alert("❌ Failed to update report.");
    }
  };

  // ✅ Optimized derived filtered list
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const matchStatus =
        filterStatus === "all"
          ? true
          : filterStatus === "pending"
          ? !r.reviewed
          : r.reviewed;

      const matchDate = filterDate ? r.date === filterDate : true;

      const matchRef =
        filterRef.trim() === "" ||
        r.referee.toLowerCase().includes(filterRef.toLowerCase()) ||
        r.refereeEmail.toLowerCase().includes(filterRef.toLowerCase());

      const matchType =
        filterType.trim() === "" ||
        r.type.toLowerCase() === filterType.toLowerCase();

      return matchStatus && matchDate && matchRef && matchType;
    });
  }, [reports, filterStatus, filterRef, filterDate, filterType]);

  // ✅ Badge logic
  const getTypeBadge = (type: string) => {
    switch (type) {
      case "red_card":
        return <Badge variant="danger">🟥 Red Card</Badge>;
      case "incident":
        return <Badge variant="warning">Incident</Badge>;
      default:
        return <Badge variant="outline">📝 General</Badge>;
    }
  };

  const resetFilters = () => {
    setFilterStatus("all");
    setFilterRef("");
    setFilterDate("");
    setFilterType("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Referee Reports</h2>
          <p className="text-gray-500 text-sm">View and manage referee reports below.</p>
        </div>

        {/* Status Filter Buttons */}
        <div className="flex gap-2">
          <Button
            variant={filterStatus === "all" ? "default" : "outline"}
            onClick={() => setFilterStatus("all")}
          >
            All
          </Button>
          <Button
            variant={filterStatus === "pending" ? "default" : "outline"}
            onClick={() => setFilterStatus("pending")}
          >
            Pending
          </Button>
          <Button
            variant={filterStatus === "reviewed" ? "default" : "outline"}
            onClick={() => setFilterStatus("reviewed")}
          >
            Reviewed
          </Button>
        </div>
      </div>

      {/* 🔍 Search & Filters */}
      <div className="flex flex-col md:flex-row flex-wrap gap-4 items-end">
        <div className="flex flex-col space-y-1 w-full md:w-1/3">
          <label className="text-sm font-semibold text-gray-600">Filter by Referee</label>
          <input
            type="text"
            placeholder="Name or email..."
            value={filterRef}
            onChange={(e) => setFilterRef(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2"
          />
        </div>

        <div className="flex flex-col space-y-1 w-full md:w-1/3">
          <label className="text-sm font-semibold text-gray-600">Filter by Date</label>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2"
          />
        </div>

        <div className="flex flex-col space-y-1 w-full md:w-1/4">
          <label className="text-sm font-semibold text-gray-600">Filter by Type</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2"
          >
            <option value="">All Types</option>
            <option value="red_card">Red Card</option>
            <option value="incident">Incident</option>
            <option value="general">General</option>
          </select>
        </div>

        <Button variant="outline" onClick={resetFilters} className="h-10 mt-1 md:mt-0">
          🔄 Reset
        </Button>
      </div>

      {/* 🧾 Reports List */}
      {loading ? (
        <p className="text-gray-500 text-center py-8 animate-pulse">Loading reports...</p>
      ) : filteredReports.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No reports found.</p>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => (
            <Card
              key={report.id}
              className="p-4 hover:border-emerald-500 border-2 border-transparent transition-all cursor-pointer"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getTypeBadge(report.type)}
                    {report.reviewed && (
                      <Badge variant="success">✅ Reviewed</Badge>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {report.referee}
                  </h3>
                  <p className="text-sm text-gray-600 mb-1">📅 {report.date}</p>
                  <p className="text-sm text-gray-600 mb-2">
                    📧 {report.refereeEmail}
                  </p>

                  {report.lawBroken && (
                    <p className="text-sm text-gray-700 mb-1">
                      ⚖️ <strong>Law Broken:</strong> {report.lawBroken}
                    </p>
                  )}

                  <p className="text-gray-800 whitespace-pre-line">
                    {report.description}
                  </p>
                </div>

                {!report.reviewed && (
                  <Button
                    size="sm"
                    className="ml-4"
                    onClick={() => handleMarkReviewed(report.id)}
                  >
                    Mark as Reviewed
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
