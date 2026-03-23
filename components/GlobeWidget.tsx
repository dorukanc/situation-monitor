"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import createGlobe, { type Marker } from "cobe";
import WidgetCard from "./WidgetCard";

// World clock cities
const CITIES: { name: string; lat: number; lng: number; tz: string }[] = [
  { name: "IST", lat: 41.01, lng: 28.98, tz: "Europe/Istanbul" },
  { name: "NYC", lat: 40.71, lng: -74.01, tz: "America/New_York" },
  { name: "LON", lat: 51.51, lng: -0.13, tz: "Europe/London" },
  { name: "TYO", lat: 35.68, lng: 139.69, tz: "Asia/Tokyo" },
  { name: "SF", lat: 37.77, lng: -122.42, tz: "America/Los_Angeles" },
];

// Default map center (Istanbul)
const MY_LOCATION: [number, number] = [41.01, 28.98];

function getCityTime(tz: string): string {
  return new Date().toLocaleTimeString("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function GlobeWidget() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const globeRef = useRef<ReturnType<typeof createGlobe> | null>(null);
  const phiRef = useRef(0);
  const commitPulseRef = useRef(0); // decays over time for glow effect
  const [commitCount, setCommitCount] = useState(0);
  const [cityTimes, setCityTimes] = useState<Record<string, string>>({});
  const [flowMode, setFlowMode] = useState(false);

  // Listen for flow mode changes
  useEffect(() => {
    const check = () => {
      setFlowMode(document.documentElement.getAttribute("data-flow") === "true");
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-flow"] });
    return () => observer.disconnect();
  }, []);

  // Update city clocks every minute
  useEffect(() => {
    const updateTimes = () => {
      const times: Record<string, string> = {};
      for (const city of CITIES) {
        times[city.name] = getCityTime(city.tz);
      }
      setCityTimes(times);
    };
    updateTimes();
    const interval = setInterval(updateTimes, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch today's GitHub commits for pulse glow
  const fetchCommits = useCallback(async () => {
    try {
      const res = await fetch("/api/github");
      if (!res.ok) return;
      const data: { date: string; count: number }[] = await res.json();
      const today = new Date().toISOString().split("T")[0];
      const todayData = data.find((d) => d.date === today);
      const count = todayData?.count || 0;
      // If count increased, trigger a pulse
      setCommitCount((prev) => {
        if (count > prev) {
          commitPulseRef.current = 1.0; // full glow
        }
        return count;
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchCommits();
    const interval = setInterval(fetchCommits, 60000); // check every minute
    return () => clearInterval(interval);
  }, [fetchCommits]);

  // Create globe
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const width = canvas.offsetWidth;

    // City markers (small, subtle)
    const cityMarkers: Marker[] = CITIES.map((city) => ({
      location: [city.lat, city.lng] as [number, number],
      size: 0.03,
    }));

    const globe = createGlobe(canvas, {
      devicePixelRatio: 2,
      width: width * 2,
      height: width * 2,
      phi: 0,
      theta: 0.15,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 3,
      baseColor: [0.12, 0.12, 0.12],
      markerColor: flowMode ? [1, 0.2, 0.2] : [0, 1, 0.25],
      glowColor: flowMode ? [0.15, 0.03, 0.03] : [0.03, 0.15, 0.03],
      markers: cityMarkers,
    });

    globeRef.current = globe;

    // Calculate sun longitude for day/night effect
    // The sun's longitude roughly tracks UTC hour
    const getSunPhi = () => {
      const now = new Date();
      const hours = now.getUTCHours() + now.getUTCMinutes() / 60;
      // Sun is at longitude 0 at 12:00 UTC, moves west 15°/hour
      // Convert to radians: (180 - hours * 15) * PI / 180
      return ((180 - hours * 15) * Math.PI) / 180;
    };

    // Start phi near sun position so the lit side is visible
    phiRef.current = getSunPhi();

    let animFrame: number;
    const animate = () => {
      phiRef.current += 0.002; // slow drift
      globe.update({ phi: phiRef.current });

      // Decay the commit pulse glow
      if (commitPulseRef.current > 0) {
        commitPulseRef.current = Math.max(0, commitPulseRef.current - 0.005);
      }

      // Update my location marker size based on commit activity
      const baseSize = 0.04;
      const pulseSize = commitPulseRef.current * 0.12;
      const myMarker: Marker = {
        location: MY_LOCATION,
        size: baseSize + pulseSize,
      };

      const allMarkers: Marker[] = [...cityMarkers, myMarker];
      globe.update({ markers: allMarkers });

      animFrame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animFrame);
      globe.destroy();
    };
  }, [flowMode]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <WidgetCard title="Globe">
      <div className="flex items-center justify-center h-full relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="aspect-square h-full"
          style={{ contain: "layout" }}
        />
        {/* World clocks overlay */}
        <div className="absolute bottom-1 left-1 right-1 flex justify-center gap-3 flex-wrap">
          {CITIES.map((city) => (
            <div key={city.name} className="flex flex-col items-center">
              <span className="text-[8px] text-muted uppercase tracking-wider">{city.name}</span>
              <span className="text-[9px] text-green font-bold">{cityTimes[city.name] || "--:--"}</span>
            </div>
          ))}
        </div>
        {/* Commit activity indicator */}
        {commitCount > 0 && (
          <div className="absolute top-1 right-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green pulse-dot" />
            <span className="text-[8px] text-green font-bold">{commitCount} commits</span>
          </div>
        )}
      </div>
    </WidgetCard>
  );
}
