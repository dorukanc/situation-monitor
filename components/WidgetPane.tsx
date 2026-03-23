"use client";

import { useState, useRef, useCallback } from "react";
import { WIDGET_REGISTRY, getWidgetMeta } from "@/lib/widget-registry";

interface WidgetPaneProps {
  open: boolean;
  onClose: () => void;
  layout: string[];
  onLayoutChange: (layout: string[]) => void;
}

export default function WidgetPane({ open, onClose, layout, onLayoutChange }: WidgetPaneProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragNode = useRef<HTMLDivElement | null>(null);

  const isEnabled = (id: string) => layout.includes(id);

  const toggle = (id: string) => {
    if (isEnabled(id)) {
      onLayoutChange(layout.filter((w) => w !== id));
    } else {
      // Add after last widget of same size, or at end
      const meta = getWidgetMeta(id);
      if (!meta) return;

      if (meta.size === "mini") {
        // Insert after last mini or at end
        const lastMiniIdx = layout.reduce(
          (acc, w, i) => (getWidgetMeta(w)?.size === "mini" ? i : acc),
          -1
        );
        const newLayout = [...layout];
        newLayout.splice(lastMiniIdx + 1, 0, id);
        onLayoutChange(newLayout);
      } else {
        // Insert before first mini or at end
        const firstMiniIdx = layout.findIndex((w) => getWidgetMeta(w)?.size === "mini");
        if (firstMiniIdx === -1) {
          onLayoutChange([...layout, id]);
        } else {
          const newLayout = [...layout];
          newLayout.splice(firstMiniIdx, 0, id);
          onLayoutChange(newLayout);
        }
      }
    }
  };

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, idx: number) => {
      setDragIdx(idx);
      dragNode.current = e.currentTarget;
      e.dataTransfer.effectAllowed = "move";
      // Make the drag image slightly transparent
      requestAnimationFrame(() => {
        if (dragNode.current) {
          dragNode.current.style.opacity = "0.4";
        }
      });
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, idx: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragIdx === null || dragIdx === idx) return;
      setDragOverIdx(idx);
    },
    [dragIdx]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, dropIdx: number) => {
      e.preventDefault();
      if (dragIdx === null || dragIdx === dropIdx) return;

      const newLayout = [...layout];
      const [dragged] = newLayout.splice(dragIdx, 1);
      newLayout.splice(dropIdx, 0, dragged);
      onLayoutChange(newLayout);
      setDragIdx(null);
      setDragOverIdx(null);
    },
    [dragIdx, layout, onLayoutChange]
  );

  const handleDragEnd = useCallback(() => {
    if (dragNode.current) {
      dragNode.current.style.opacity = "1";
    }
    setDragIdx(null);
    setDragOverIdx(null);
    dragNode.current = null;
  }, []);

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const newLayout = [...layout];
    [newLayout[idx - 1], newLayout[idx]] = [newLayout[idx], newLayout[idx - 1]];
    onLayoutChange(newLayout);
  };

  const moveDown = (idx: number) => {
    if (idx >= layout.length - 1) return;
    const newLayout = [...layout];
    [newLayout[idx], newLayout[idx + 1]] = [newLayout[idx + 1], newLayout[idx]];
    onLayoutChange(newLayout);
  };

  // All widgets not in layout (available to add)
  const disabledWidgets = WIDGET_REGISTRY.filter((w) => !layout.includes(w.id));

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-80 bg-background border-l border-border z-50 flex flex-col widget-pane-enter">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-green font-medium">
            Widget Configuration
          </h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground text-xs cursor-pointer transition-colors"
          >
            [ESC]
          </button>
        </div>

        {/* Active widgets */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="px-4 py-2">
            <div className="text-[8px] uppercase tracking-[0.2em] text-muted mb-2">
              Active Widgets — drag to reorder
            </div>

            <div className="space-y-1">
              {layout.map((id, idx) => {
                const meta = getWidgetMeta(id);
                if (!meta) return null;

                return (
                  <div
                    key={id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={(e) => handleDrop(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-2 px-2 py-1.5 border transition-colors group ${
                      dragOverIdx === idx && dragIdx !== idx
                        ? "border-green/40 bg-green/5"
                        : "border-border hover:border-border"
                    }`}
                  >
                    {/* Drag handle */}
                    <span className="text-muted/40 group-hover:text-muted cursor-grab active:cursor-grabbing text-[10px] select-none">
                      ⠿
                    </span>

                    {/* Widget info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-foreground truncate">
                          {meta.name}
                        </span>
                        <span className="text-[7px] uppercase tracking-wider text-muted/50 border border-border px-1 flex-shrink-0">
                          {meta.size}
                        </span>
                      </div>
                      <div className="text-[8px] text-muted/50 truncate">
                        {meta.description}
                      </div>
                    </div>

                    {/* Move buttons */}
                    <div className="flex flex-col gap-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => moveUp(idx)}
                        disabled={idx === 0}
                        className="text-[8px] text-muted hover:text-green disabled:text-muted/20 cursor-pointer disabled:cursor-default leading-none"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveDown(idx)}
                        disabled={idx === layout.length - 1}
                        className="text-[8px] text-muted hover:text-green disabled:text-muted/20 cursor-pointer disabled:cursor-default leading-none"
                      >
                        ▼
                      </button>
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => toggle(id)}
                      className="text-[8px] text-muted hover:text-red transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                      title="Remove widget"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Available (disabled) widgets */}
          {disabledWidgets.length > 0 && (
            <div className="px-4 py-2 border-t border-border">
              <div className="text-[8px] uppercase tracking-[0.2em] text-muted mb-2">
                Available Widgets
              </div>

              <div className="space-y-1">
                {disabledWidgets.map((meta) => (
                  <div
                    key={meta.id}
                    className="flex items-center gap-2 px-2 py-1.5 border border-border/50 opacity-50 hover:opacity-100 transition-opacity group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-foreground/60 truncate">
                          {meta.name}
                        </span>
                        <span className="text-[7px] uppercase tracking-wider text-muted/30 border border-border/50 px-1 flex-shrink-0">
                          {meta.size}
                        </span>
                      </div>
                      <div className="text-[8px] text-muted/30 truncate">
                        {meta.description}
                      </div>
                    </div>

                    <button
                      onClick={() => toggle(meta.id)}
                      className="text-[8px] text-muted hover:text-green transition-colors cursor-pointer"
                      title="Add widget"
                    >
                      [+ADD]
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border flex items-center justify-between">
          <span className="text-[8px] text-muted/50 uppercase tracking-wider">
            {layout.length} widget{layout.length !== 1 ? "s" : ""} active
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1 text-[9px] uppercase tracking-wider border border-green/30 text-green hover:bg-green/10 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </>
  );
}
