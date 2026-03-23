import DashboardGrid from "@/components/DashboardGrid";
import FlowToggle from "@/components/FlowToggle";
import StatusTicker from "@/components/StatusTicker";

export default function Home() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-2 border-b border-border flex-shrink-0">
        <h1 className="text-xs uppercase tracking-[0.3em] font-bold text-foreground">
          Situation Monitor
        </h1>
        <div className="flex items-center gap-3">
          <FlowToggle />
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green pulse-dot" />
            <span className="text-[10px] uppercase tracking-[0.2em] text-green">
              Online
            </span>
          </div>
        </div>
      </header>

      {/* Dynamic Widget Grid */}
      <DashboardGrid />

      {/* Ticker */}
      <StatusTicker />
    </div>
  );
}
