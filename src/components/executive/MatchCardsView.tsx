import React, { useEffect, useMemo, useState, useRef } from "react";
import { db } from "../../lib/firebase";
import { collection, query, onSnapshot, orderBy, doc, getDoc } from "firebase/firestore";
import {
  Trophy,
  Download,
  ChevronDown,
  Shield,
} from "lucide-react";
import { Button } from "../ui/Button";
import { motion, AnimatePresence } from "framer-motion";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
} from "date-fns";
import { toast } from "../../hooks/use-toast";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface MatchResult {
  id: string;
  homeTeam: string;
  awayTeam: string;
  venue: string;
  refereeName: string;
  homeScore: number;
  awayScore: number;
  homeTries?: number;
  awayTries?: number;
  submittedAt: any;
  appointmentId?: string;
  homeSquad?: Array<any>;
  awaySquad?: Array<any>;
  dateObj: Date;
}

const LOGO_PATH = "/img/epru_logo.jpeg"; // Adjust path as needed

export const MatchCardsView: React.FC = () => {
  const [results, setResults] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  const [expandedMatches, setExpandedMatches] = useState<Record<string, Set<string>>>({});

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const q = query(collection(db, "match_results"), orderBy("submittedAt", "desc"));

    const unsub = onSnapshot(q, async (snapshot) => {
      const resultsData = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          const fallbackRefName =
            data.homeSquad?.[0]?.refereeName ||
            data.awaySquad?.[0]?.refereeName ||
            "Official";

          let venue = "TBD",
            homeTeam = "Home",
            awayTeam = "Away";

          if (data.appointmentId) {
            const aptRef = doc(db, "appointments", data.appointmentId);
            const aptSnap = await getDoc(aptRef);
            if (aptSnap.exists()) {
              const aptData = aptSnap.data();
              venue = aptData.venue || venue;
              homeTeam = aptData.homeTeam || homeTeam;
              awayTeam = aptData.awayTeam || awayTeam;
            }
          }

          return {
            id: docSnap.id,
            ...data,
            homeTeam,
            awayTeam,
            venue,
            refereeName: data.refereeName || fallbackRefName,
            dateObj: data.submittedAt?.toDate?.() || new Date(),
          } as MatchResult;
        })
      );

      setResults(resultsData);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const { refereeStats, activeRefs } = useMemo(() => {
    const start = startOfMonth(parseISO(`${selectedMonth}-01`));
    const end = endOfMonth(start);
    const grouped: Record<string, { matches: MatchResult[]; count: number }> = {};

    results.forEach((res) => {
      if (isWithinInterval(res.dateObj, { start, end })) {
        const name = res.refereeName;
        if (!grouped[name]) grouped[name] = { matches: [], count: 0 };
        grouped[name].matches.push(res);
        grouped[name].count++;
      }
    });

    return { refereeStats: grouped, activeRefs: Object.keys(grouped).length };
  }, [results, selectedMonth]);

  const toggleMatch = (refName: string, matchId: string) => {
    setExpandedMatches((prev) => {
      const currentSet = prev[refName] ? new Set(prev[refName]) : new Set<string>();
      if (currentSet.has(matchId)) {
        currentSet.delete(matchId);
      } else {
        currentSet.add(matchId);
      }
      return { ...prev, [refName]: currentSet };
    });
  };

  const downloadPDF = async (refName: string) => {
    const element = sectionRefs.current[refName];
    if (!element) {
      toast({ variant: "destructive", title: "Error", description: "Section not found" });
      return;
    }

    setIsExporting(true);

    try {
      // ────────────────────────────────────────────────
      // 1. Temporarily expand ALL matches for this referee
      // ────────────────────────────────────────────────
      setExpandedMatches((prev) => {
        const newSets = { ...prev };
        const allIds = refereeStats[refName]?.matches.map(m => m.id) || [];
        newSets[refName] = new Set(allIds);
        return newSets;
      });

      // Give React time to render + layout the full content
      await new Promise(resolve => setTimeout(resolve, 600)); // 400–800ms usually enough

      // ────────────────────────────────────────────────
      // 2. Capture now that everything is expanded
      // ────────────────────────────────────────────────
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: element.scrollWidth,
        height: element.scrollHeight,        // ← important
        width: element.scrollWidth,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgProps = pdf.getImageProperties(imgData);
      let pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);

      // Simple multi-page (if very long)
      let heightLeft = pdfHeight - pdf.internal.pageSize.getHeight();
      let position = -pdf.internal.pageSize.getHeight();

      while (heightLeft > 0) {
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
        position -= pdf.internal.pageSize.getHeight();
      }

      pdf.save(`MatchReport_${refName.replace(/\s+/g, "_")}_${selectedMonth}.pdf`);

      toast({ title: "Success", description: "PDF downloaded" });
    } catch (error) {
      console.error("PDF generation failed:", error);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Could not generate the PDF – check console",
      });
    } finally {
      // ────────────────────────────────────────────────
      // 3. Restore original expanded state (optional – or leave expanded)
      // ────────────────────────────────────────────────
      setExpandedMatches((prev) => {
        const restored = { ...prev };
        if (restored[refName]) {
          // restored[refName] = new Set();   ← collapse all again
          // or keep as-is: delete restored[refName];
        }
        return restored;
      });

      setIsExporting(false);
    }
  };


  if (loading) {
    return (
      <div className="p-10 text-center font-bold text-slate-500 animate-pulse">
        Loading match records...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8 min-h-screen bg-slate-50">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              .no-print { display: none !important; }
              body { background: white !important; margin: 0; }
              .match-card { 
                break-inside: avoid; 
                page-break-inside: avoid;
                border: 1px solid #000 !important;
                margin-bottom: 30px !important;
                padding: 20px !important;
              }

              @media print {
              .overflow-hidden { overflow: visible !important; height: auto !important; }
              [style*="height: 0px"] { height: auto !important; }
              .print\\:h-auto { height: auto !important; }
              .print\\:!opacity-100 { opacity: 1 !important; }
            }
                          .logo-container { 
                position: absolute !important;
                top: 8mm !important;
                right: 8mm !important;
                width: 60mm !important;
                height: auto !important;
              }
              .logo-container img {
                max-width: 100% !important;
                height: auto !important;
              }
              .signature-box { display: flex !important; margin-top: 40px !important; justify-content: space-between !important; }
            }
          `,
        }}
      />

      {/* Screen-only header */}
      <div className="no-print bg-white rounded-2xl shadow-sm border p-6 mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-3">
            <Trophy className="text-emerald-600" size={32} /> Official Match Cards
          </h2>
          <p className="text-slate-500 text-sm mt-1">Monthly archive & PDF export</p>
        </div>

        <div className="flex items-center gap-3 bg-slate-50 rounded-xl border px-3 py-2">
          <span className="text-xs font-bold uppercase text-slate-500">Month:</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-transparent border-none text-sm font-medium outline-none"
          />
        </div>
      </div>

      {activeRefs === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
          <p className="text-slate-400 font-medium">No match results found for {selectedMonth}</p>
        </div>
      ) : (
        <div className="space-y-10">
          {Object.entries(refereeStats).map(([refName, { matches }]) => {
            const expandedForRef = expandedMatches[refName] || new Set<string>();

            return (
              <div
                key={refName}
                ref={(el) => (sectionRefs.current[refName] = el)}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border-gray-300 relative"
              >
                {/* Logo – only in PDF, top-right */}
                <div className="logo-container ">
                  <img
                    src={LOGO_PATH}
                    alt="EPRU Logo"
                    className="h-auto w-48 object-contain"
                    crossOrigin="anonymous"
                  />
                </div>

                {/* Referee header */}
                <div className="px-6 md:px-8 pt-6 pb-4 border-b">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h3 className="text-2xl md:text-3xl font-black text-slate-900">{refName}</h3>
                      <p className="text-slate-500 mt-1">
                        {matches.length} match{matches.length !== 1 ? "es" : ""} • {selectedMonth}
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadPDF(refName)}
                      disabled={isExporting}
                      className="no-print gap-2"
                    >
                      <Download size={16} />
                      Export PDF
                    </Button>
                  </div>
                </div>

                {/* Matches */}
                <div className="p-6 md:p-8 space-y-6">
                  {matches.map((match) => {
                    const isExpanded = expandedForRef.has(match.id);

                    return (
                      <div
                        key={match.id}
                        className="border border-slate-200 rounded-2xl overflow-hidden bg-white print:border-black print:rounded-none match-card"
                      >
                        {/* Summary header – clickable on screen */}
                        <div
                          className="flex justify-between items-center px-6 py-4 cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors print:cursor-default print:bg-white print:p-0 print:hover:bg-white"
                          onClick={() => toggleMatch(refName, match.id)}
                        >
                          <div className="text-sm text-slate-600 mt-1 print:text-base print:font-medium">
                            <span className="font-medium">
                              {match.homeTeam} {match.homeScore} (  {match.homeTries ?? 0}) : {match.awayTeam} {match.awayScore} ({match.awayTries ?? 0})
                            </span> •{" "}
                            {/* {format(match.dateObj, "dd MMM yyyy")} •{" "} */}
                          </div>

                          <div className="flex items-center gap-3 print:hidden">
                            <span className="text-sm text-slate-600 font-medium">Details</span>
                            <ChevronDown
                              size={20}
                              className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            />
                          </div>
                        </div>

                        <AnimatePresence>
                          <motion.div
                            initial={false}
                            animate={{ height: isExpanded ? "auto" : 0, opacity: isExpanded ? 1 : 0 }}
                            className="overflow-hidden print:!h-auto print:!opacity-100 print:animate-none"
                          >
                            <div className="p-6 pt-4 print:p-8 print:pt-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <SquadTable
                                  title={match.homeSquad?.[0]?.teamName || match.homeTeam || "Home Team"}
                                  squad={match.homeSquad}
                                  color="blue"
                                />
                                <SquadTable
                                  title={match.awaySquad?.[0]?.teamName || match.awayTeam || "Away Team"}
                                  squad={match.awaySquad}
                                  color="red"
                                />
                              </div>

                              <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-6 bg-slate-50 p-5 rounded-xl border print:bg-white print:border-none">
                                <div>
                                  <div className="text-xs font-black uppercase text-slate-500">Venue</div>
                                  <div className="font-medium">{match.venue}</div>
                                </div>
                                <div>
                                  <div className="text-xs font-black uppercase text-slate-500">Referee</div>
                                  <div className="font-medium">{match.refereeName}</div>
                                </div>
                                <div className="text-right sm:text-left">
                                  <div className="text-xs font-black uppercase text-slate-500">Submitted</div>
                                  <div className="font-medium">{format(match.dateObj, "dd MMM yyyy")}</div>
                                </div>
                              </div>

                              {/* Updated signatures section */}
                              <div className="signature-box flex flex-col sm:flex-row justify-between gap-10 mt-12 pt-8 border-t border-slate-200 print:mt-16 print:pt-12">
                                <div>
                                  <div className="text-xs font-black uppercase text-slate-500 mb-3">
                                    Referee Signature
                                  </div>
                                  <div className="w-64 border-b border-slate-400 pb-1"></div>
                                  <div className="mt-2 text-sm font-medium">{match.refereeName}</div>
                                </div>

                                <div className="text-right">
                                  <div className="text-xs font-black uppercase text-slate-500 mb-3">
                                    Result Received by Executive
                                  </div>
                                  <div className="w-64 border-b border-slate-400 pb-1 ml-auto"></div>
                                  <div className="mt-2 text-sm text-slate-600">
                                    Date & Time: ____ / ____ / ____  ____:____
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const SquadTable = ({
  title,
  squad,
  color,
}: {
  title: string;
  squad?: any[];
  color: "blue" | "red";
}) => (
  <div className="space-y-4">
    <div
      className={`flex items-center gap-2 pb-2 border-b-2 font-semibold ${color === "blue" ? "border-blue-600 text-blue-700" : "border-red-600 text-red-700"
        }`}
    >
      <Shield size={16} />
      <span className="uppercase text-sm tracking-wide">{title}</span>
    </div>

    <div className="space-y-2">
      {squad?.map((player: any, i: number) => (
        <div
          key={i}
          className="flex justify-between items-center text-sm bg-slate-50/70 p-3 rounded-lg border border-slate-100"
        >
          <div>
            <div className="font-medium">
              {player.firstName} {player.lastName}
            </div>
            <div className="text-xs text-slate-500">{player.position || "Player"}</div>
          </div>
          <div className="text-slate-400 font-mono font-bold">
            #{player.position?.match(/\d+/)?.[0] || i + 1}
          </div>
        </div>
      )) || <div className="text-slate-400 text-sm italic">No squad data</div>}
    </div>
  </div>
);