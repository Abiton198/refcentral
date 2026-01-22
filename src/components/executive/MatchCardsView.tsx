import React, { useEffect, useMemo, useState, useRef } from "react";
import { db } from "../../lib/firebase";
import { collection, query, onSnapshot, orderBy, doc, getDoc } from "firebase/firestore";
import { 
  FileText, Printer, ChevronDown, MapPin, 
  User, Shield, Search, Trophy, CheckCircle, Download
} from "lucide-react";
import { Button } from "../ui/Button";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { toast } from "../../hooks/use-toast";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";


export const MatchCardsView: React.FC = () => {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedRef, setExpandedRef] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  
  // Ref to the specific referee section for PDF capture
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(db, "match_results"), orderBy("submittedAt", "desc"));
    const unsub = onSnapshot(q, async (snapshot) => {
      const resultsData = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          const fallbackRefName = data.homeSquad?.[0]?.refereeName || data.awaySquad?.[0]?.refereeName || "Official";
          let venue = "TBD", homeTeam = "Home", awayTeam = "Away";

          if (data.appointmentId) {
            const aptRef = doc(db, "appointments", data.appointmentId);
            const aptSnap = await getDoc(aptRef);
            if (aptSnap.exists()) {
              const aptData = aptSnap.data();
              venue = aptData.venue;
              homeTeam = aptData.homeTeam;
              awayTeam = aptData.awayTeam;
            }
          }
          return { 
            id: docSnap.id, 
            ...data, 
            homeTeam, 
            awayTeam, 
            venue, 
            refereeName: data.refereeName || fallbackRefName, 
            dateObj: data.submittedAt?.toDate() || new Date() 
          };
        })
      );
      setResults(resultsData);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const { refereeStats, activeRefs } = useMemo(() => {
    const start = startOfMonth(parseISO(`${selectedMonth || format(new Date(), "yyyy-MM")}-01`));
    const end = endOfMonth(start);
    const grouped: Record<string, any> = {};

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

  // PDF DOWNLOAD LOGIC
  const downloadPDF = async (refName: string) => {
    if (!reportRef.current) return;
    setIsExporting(true);
    
    try {
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2, // Higher quality
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff"
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`MatchReport_${refName.replace(/\s+/g, "_")}_${selectedMonth}.pdf`);
      
      toast({ title: "PDF Generated", description: "Your match report has been downloaded." });
    } catch (error) {
      console.error("PDF Error:", error);
      toast({ variant: "destructive", title: "Export Failed", description: "Could not generate PDF." });
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) return <div className="p-10 text-center font-bold text-slate-400 animate-pulse">Loading Records...</div>;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 min-h-screen bg-[#F8FAFC]">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print { display: none !important; }
          .match-card { border: 2px solid black !important; padding: 30px !important; margin-bottom: 50px !important; border-radius: 0 !important; }
          .signature-box { display: flex !important; margin-top: 40px; }
        }
      `}} />

      {/* HEADER */}
      <div className="no-print flex flex-col md:flex-row justify-between items-center mb-8 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Trophy className="text-emerald-500" /> OFFICIAL MATCH CARDS
          </h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Digital Archive & PDF Export</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border">
            <span className="text-[10px] font-black px-2 text-slate-400 uppercase">Period:</span>
            <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-white border-none rounded-xl px-4 py-1 text-sm font-bold outline-none" />
        </div>
      </div>

      <div className="space-y-6">
        {activeRefs === 0 ? (
            <div className="text-center p-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                <p className="text-slate-400 font-bold">No match results found for this period.</p>
            </div>
        ) : (
            Object.entries(refereeStats).map(([refName, data]) => (
            <div key={refName} className="print-section bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
                
                {/* REF HEADER */}
                <div className="p-6 flex flex-col sm:flex-row justify-between items-center gap-4 border-b bg-white relative z-10">
                <button onClick={() => setExpandedRef(expandedRef === refName ? null : refName)} className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black">{refName[0]}</div>
                    <div className="text-left">
                    <h3 className="font-black text-slate-900 uppercase">{refName}</h3>
                    <p className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 rounded-md inline-block">{data.count} Matches</p>
                    </div>
                </button>
                <div className="no-print flex gap-2">
                    <Button 
                        onClick={() => downloadPDF(refName)} 
                        disabled={isExporting || expandedRef !== refName} 
                        variant="outline" 
                        size="sm" 
                        className={`rounded-xl font-bold ${expandedRef !== refName ? 'opacity-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}
                    >
                    {isExporting ? "Processing..." : <><Download size={16} className="mr-2" /> Download PDF</>}
                    </Button>
                    <Button onClick={() => window.print()} size="sm" className="bg-slate-900 text-white font-bold rounded-xl">
                    <Printer size={16} className="mr-2" /> Print
                    </Button>
                </div>
                </div>

                <AnimatePresence>
                {expandedRef === refName && (
                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="bg-slate-50/30">
                    <div ref={reportRef} className="p-6 space-y-10 bg-white">
                        {data.matches.map((match: any) => (
                        <div key={match.id} className="match-card bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm mb-10">
                            <div className="flex justify-between items-start border-b-2 border-slate-100 pb-6 mb-6">
                            <div>
                                <h4 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">{match.homeTeam} VS {match.awayTeam}</h4>
                                <div className="flex items-center gap-4 mt-2">
                                    <p className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded uppercase">Official Record</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight"> {match.venue} • {format(match.dateObj, "dd MMMM yyyy")}</p>
                                </div>
                            </div>
                            <div className="bg-slate-900 text-white px-6 py-2 rounded-xl text-3xl font-black">{match.homeScore} : {match.awayScore}</div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <SquadTable title={match.homeTeam} squad={match.homeSquad} color="blue" />
                            <SquadTable title={match.awayTeam} squad={match.awaySquad} color="red" />
                            </div>

                            {/* SIGNATURE SECTION */}
                            <div className="signature-box flex justify-between mt-12 pt-8 border-t border-slate-200">
                                <div className="text-left">
                                    <p className="text-[9px] font-black uppercase text-slate-400 mb-12">Match Official Signature</p>
                                    <div className="w-48 border-b border-slate-400"></div>
                                    <p className="text-[9px] font-bold mt-2 uppercase text-slate-600">{refName}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-black uppercase text-slate-400 mb-12">Executive Verification</p>
                                    <div className="w-48 border-b border-slate-400 ml-auto"></div>
                                    <p className="text-[9px] font-bold mt-2 text-slate-300 uppercase italic">Date: ____ / ____ / 2026</p>
                                </div>
                            </div>
                        </div>
                        ))}
                    </div>
                    </motion.div>
                )}
                </AnimatePresence>
            </div>
            ))
        )}
      </div>
    </div>
  );
};

const SquadTable = ({ title, squad, color }: any) => (
  <div className="space-y-4">
    <div className={`flex items-center gap-2 border-b-2 pb-1 ${color === 'blue' ? 'border-blue-500 text-blue-600' : 'border-red-500 text-red-600'}`}>
        <Shield size={12} />
        <p className="text-[11px] font-black uppercase">{title}</p>
    </div>
    <div className="space-y-1">
      {squad?.map((p: any, i: number) => (
        <div key={i} className="flex justify-between text-[10px] bg-slate-50/50 p-2 rounded-lg border border-slate-100/50">
          <div className="flex flex-col">
            <span className="font-black uppercase text-slate-700 leading-none">{p.firstName} {p.lastName}</span>
            <span className="text-[8px] text-slate-400 font-bold uppercase">{p.position || "Player"}</span>
          </div>
          <span className="text-slate-300 font-black flex items-center">#{p.regNumber?.toString().slice(-3) || i+1}</span>
        </div>
      ))}
    </div>
  </div>
);