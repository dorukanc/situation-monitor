"use client";

interface WidgetCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export default function WidgetCard({ title, children, className = "" }: WidgetCardProps) {
  return (
    <div
      className={`border border-border bg-surface rounded-sm p-3 flex flex-col gap-2 overflow-hidden min-h-0 ${className}`}
    >
      <h2 className="text-[10px] uppercase tracking-[0.2em] text-muted font-medium">
        {title}
      </h2>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
