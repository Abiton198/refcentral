// src/components/LawsOfTheGameWidget.tsx
import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { X, ChevronRight, BookOpen, Download, Search } from "lucide-react";

// Custom Rugby Ball SVG
const RugbyBallIcon = ({ className = "" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <ellipse cx="12" cy="12" rx="10" ry="6" />
    <path d="M2 12h20" />
    <path d="M7 7s1.5 2 5 2 5-2 5-2" />
    <path d="M7 17s1.5-2 5-2 5 2 5 2" />
  </svg>
);

// === OFFLINE LAWS CONTENT (Embedded directly in app) ===
const LAWS_OF_THE_GAME = [
  {
    title: "Law 1: The Ground",
    content: `
      **1.1** The field of play is rectangular, max 100m long × 70m wide.  
      **1.2** Goal lines are 100m apart. Try lines are within the field.  
      **1.3** The 22-metre lines are 22m from each goal line.  
      **1.4** Halfway line divides the field.  
      **1.5** Goal posts: 5.6m apart, crossbar 3m high.  
      **Sanction:** Scrum 5m from offending team's goal line.
    `,
  },
  {
    title: "Law 2: The Ball",
    content: `
      **2.1** Oval, four panels, weight 410-460g.  
      **2.2** Pressure: 65.71–68.75 kPa.  
      **2.3** If burst or deformed: stop play, replace with similar ball.  
      **2.4** Extra balls allowed on perimeter, not in in-goal.  
      **Sanction:** Penalty.
    `,
  },
  {
    title: "Law 3: Number of Players",
    content: `
      **3.1** Maximum 15 players per team.  
      **3.2** Minimum 10 to continue.  
      **3.3** 8 replacements/substitutes.  
      **3.4** Front row: 3 players who can play hooker/prop.  
      **3.5** Rolling substitutions allowed.  
      **Sanction:** Penalty if incorrect numbers.
    `,
  },
  {
    title: "Law 4: Players’ Clothing",
    content: `
      **4.1** Jersey, shorts, socks, boots.  
      **4.2** Studs must be safe, circular, max 21mm.  
      **4.3** No sharp edges, jewelry, or communication devices.  
      **4.4** Mouthguards recommended.  
      **Sanction:** Player must leave to correct.
    `,
  },
  {
    title: "Law 5: Time",
    content: `
      **5.1** 40 minutes per half + time lost.  
      **5.2** Half-time: max 15 minutes.  
      **5.3** Time lost for injury: added on.  
      **5.4** 80-minute clock shown.  
      **5.5** Game ends when ball dead after 80 mins.
    `,
  },
  {
    title: "Law 6: Match Officials",
    content: `
      **6.1** Referee in charge.  
      **6.2** Two assistant referees.  
      **6.3** TMO for tries/foul play.  
      **6.4** Referee's decision final.  
      **6.5** Players must respect officials.
    `,
  },
  {
    title: "Law 7: Advantage",
    content: `
      **7.1** Play continues after infringement if non-offending team gains benefit.  
      **7.2** Tactical or territorial advantage.  
      **7.3** Referee says “Advantage” and signals.  
      **7.4** If no advantage, return to infringement.  
      **7.5** Advantage ends when ball dead or new infringement.
    `,
  },
  {
    title: "Law 8: Scoring",
    content: `
      **8.1** Try = 5 points (ground ball in in-goal).  
      **8.2** Conversion = 2 points.  
      **8.3** Penalty goal = 3 points.  
      **8.4** Dropped goal = 3 points.  
      **8.5** Goal from mark = 3 points.
    `,
  },
  {
    title: "Law 9: Foul Play",
    content: `
      **9.1** Obstruction, unfair play, repeated infringements.  
      **9.2** Dangerous play, retaliation.  
      **9.3** No punching, stamping, tripping.  
      **9.4** Yellow card = 10 mins. Red card = sent off.  
      **Sanction:** Penalty, possible card.
    `,
  },
  {
    title: "Law 10: Offside",
    content: `
      **10.1** Player offside if ahead of teammate with ball.  
      **10.2** Must retreat behind onside line.  
      **10.3** Offside in ruck/maul/scrum/lineout.  
      **10.4** Can be put onside by opponent’s action.  
      **Sanction:** Penalty.
    `,
  },
  {
    title: "Law 11: Knock-on / Throw Forward",
    content: `
      **11.1** Ball forward from hand/arm = knock-on.  
      **11.2** Intentional forward pass = throw forward.  
      **11.3** Charge-down not knock-on.  
      **11.4** Ball into touch = lineout.  
      **Sanction:** Scrum.
    `,
  },
  {
    title: "Law 12: Tackle",
    content: `
      **12.1** Tackler must release player immediately.  
      **12.2** Tackled player must release ball.  
      **12.3** No high tackle, no tip tackle.  
      **12.4** Tackle ends when ball on ground or player held.  
      **Sanction:** Penalty.
    `,
  },
  {
    title: "Law 13: Ruck",
    content: `
      **13.1** Formed when 1+ player from each team on feet, in contact over ball.  
      **13.2** Players must join from behind gate.  
      **13.3** Hands not allowed in ruck.  
      **13.4** Offside line at hindmost foot.  
      **Sanction:** Penalty.
    `,
  },
  {
    title: "Law 14: Maul",
    content: `
      **14.1** Ball carrier bound by 1+ teammate and 1+ opponent.  
      **14.2** Must stay on feet.  
      **14.3** Maul ends successfully if ball on ground or player peels.  
      **14.4** Unsuccessful end = scrum.  
      **Sanction:** Scrum or penalty.
    `,
  },
  {
    title: "Law 15: Scrum",
    content: `
      **15.1** 8 players per team.  
      **15.2** Crouch → Bind → Set.  
      **15.3** Feed straight down middle.  
      **15.4** No wheeling beyond 45°.  
      **Sanction:** Free kick or penalty.
    `,
  },
  {
    title: "Law 16: Lineout",
    content: `
      **16.1** 2+ players per team, straight line.  
      **16.2** Throw straight.  
      **16.3** Quick throw allowed (same ball).  
      **16.4** Gaps 1m.  
      **Sanction:** Free kick.
    `,
  },
  {
    title: "Law 17: Kick-Off & Restart",
    content: `
      **17.1** Drop kick from center.  
      **17.2** Ball must travel 10m.  
      **17.3** 22m drop-out if ball dead in in-goal.  
      **17.4** Receiving team can catch or play.  
      **Sanction:** Retake or scrum.
    `,
  },
  {
    title: "Law 18: Mark",
    content: `
      **18.1** Call “Mark” inside 22m from clean catch of kick.  
      **18.2** Free kick awarded.  
      **18.3** Opponents must retreat 10m.  
      **18.4** Mark lost if player runs with ball.  
      **Sanction:** Free kick.
    `,
  },
  {
    title: "Law 19: Touch & Lineout",
    content: `
      **19.1** Ball in touch if touches line or beyond.  
      **19.2** Quick throw allowed.  
      **19.3** Lineout to non-kicking team (unless kick direct to touch).  
      **19.4** Gain in touch = option.  
      **Sanction:** Lineout.
    `,
  },
  {
    title: "Law 20: Penalty & Free Kick",
    content: `
      **20.1** Penalty: kick at goal, scrum, tap.  
      **20.2** Free kick: tap, scrum (no goal).  
      **20.3** Quick tap allowed.  
      **20.4** Mark for penalty.  
      **Sanction:** Advantage or retake.
    `,
  },
  {
    title: "Law 21: In-Goal",
    content: `
      **21.1** Try scored by grounding ball in in-goal.  
      **21.2** Ball dead if held up or goes dead.  
      **21.3** 5m scrum if attacking team knocks on in in-goal.  
      **21.4** 22m drop-out if defending team makes ball dead.  
      **Sanction:** Scrum or drop-out.
    `,
  },
];

export const LawsOfTheGameWidget: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedLaw, setSelectedLaw] = useState<number | null>(null);

  const filteredLaws = useMemo(() => {
    if (!search.trim()) return LAWS_OF_THE_GAME;
    const term = search.toLowerCase();
    return LAWS_OF_THE_GAME.filter(
      (law) =>
        law.title.toLowerCase().includes(term) ||
        law.content.toLowerCase().includes(term)
    );
  }, [search]);

  return (
    <>
      {/* Floating Rugby Ball */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 group flex items-center justify-center w-14 h-14 bg-gradient-to-br from-orange-500 to-amber-600 rounded-full shadow-2xl hover:shadow-orange-500/50 transform hover:scale-110 transition-all duration-200"
        aria-label="Open Laws"
      >
        <RugbyBallIcon className="w-7 h-7 text-white transform -rotate-12 group-hover:rotate-0 transition-transform" />
      </button>

      {/* Offline Laws Panel */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
          {/* Header */}
          <SheetHeader className="p-5 pb-3 border-b bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BookOpen className="w-6 h-6" />
                <SheetTitle className="text-xl font-bold">Laws of the Game</SheetTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setOpen(false);
                  setSelectedLaw(null);
                  setSearch("");
                }}
                className="text-white hover:bg-white/20"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <p className="text-sm text-emerald-100">Offline • Full Text • Searchable</p>
          </SheetHeader>

          {/* Search */}
          <div className="p-4 border-b bg-gray-50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search laws..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1">
            <div className="p-4 pb-24 space-y-3">
              {selectedLaw !== null ? (
                <Card className="p-5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedLaw(null)}
                    className="mb-3"
                  >
                    ← Back to List
                  </Button>
                  <h3 className="text-lg font-bold text-emerald-700 mb-3">
                    {LAWS_OF_THE_GAME[selectedLaw].title}
                  </h3>
                  <div
                    className="prose prose-sm max-w-none text-gray-700 whitespace-pre-line"
                    dangerouslySetInnerHTML={{
                      __html: LAWS_OF_THE_GAME[selectedLaw].content
                        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                        .replace(/\n/g, "<br>"),
                    }}
                  />
                </Card>
              ) : filteredLaws.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No laws found.</p>
              ) : (
                filteredLaws.map((law, i) => (
                  <Card
                    key={i}
                    className="p-4 hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-emerald-500"
                    onClick={() => setSelectedLaw(LAWS_OF_THE_GAME.indexOf(law))}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        {law.title}
                        <ChevronRight className="w-4 h-4 text-emerald-600" />
                      </h3>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-4 bg-white border-t">
            <Button variant="outline" className="w-full text-xs" asChild>
              <a
                href="https://laws.worldrugby.org/downloads/World_Rugby_Laws_2025_EN.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download Official PDF
              </a>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};