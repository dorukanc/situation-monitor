"use client";

import { useState, useEffect, useCallback } from "react";
import WidgetCard from "./WidgetCard";

interface WeatherData {
  current: {
    temperature_2m: number;
    weather_code: number;
    wind_speed_10m: number;
    relative_humidity_2m: number;
  };
}

const WEATHER_CODES: Record<number, string> = {
  0: "Clear",
  1: "Mostly Clear",
  2: "Partly Cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime Fog",
  51: "Light Drizzle",
  53: "Drizzle",
  55: "Heavy Drizzle",
  61: "Light Rain",
  63: "Rain",
  65: "Heavy Rain",
  71: "Light Snow",
  73: "Snow",
  75: "Heavy Snow",
  80: "Rain Showers",
  81: "Rain Showers",
  82: "Heavy Showers",
  95: "Thunderstorm",
  96: "Hail Storm",
  99: "Heavy Hail",
};

function getWeatherIcon(code: number): string {
  if (code === 0) return "\u2600";       // sun
  if (code <= 2) return "\u26C5";        // sun behind cloud
  if (code === 3) return "\u2601";       // cloud
  if (code <= 48) return "\u2601";       // fog/cloud
  if (code <= 55) return "\uD83C\uDF27"; // drizzle
  if (code <= 65) return "\uD83C\uDF27"; // rain
  if (code <= 75) return "\u2744";       // snow
  if (code <= 82) return "\uD83C\uDF27"; // showers
  return "\u26A1";                        // thunder
}

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [location, setLocation] = useState({ lat: 41.01, lon: 28.98 }); // Istanbul default
  const [mounted, setMounted] = useState(false);

  const fetchWeather = useCallback(async (lat: number, lon: number) => {
    try {
      const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      if (data.current) setWeather(data);
    } catch {
      // keep existing data
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    // Try to get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          setLocation(loc);
          fetchWeather(loc.lat, loc.lon);
        },
        () => fetchWeather(location.lat, location.lon) // fallback to Istanbul
      );
    } else {
      fetchWeather(location.lat, location.lon);
    }

    const interval = setInterval(() => fetchWeather(location.lat, location.lon), 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted || !weather) {
    return (
      <WidgetCard title="Weather">
        <div className="text-muted text-[9px] flex items-center justify-center h-full">
          Loading...
        </div>
      </WidgetCard>
    );
  }

  const { temperature_2m, weather_code, wind_speed_10m, relative_humidity_2m } = weather.current;

  return (
    <WidgetCard title="Weather">
      <div className="flex flex-col items-center justify-center h-full gap-1">
        <span className="text-2xl">{getWeatherIcon(weather_code)}</span>
        <span className="text-lg font-bold text-foreground">{Math.round(temperature_2m)}°C</span>
        <span className="text-[8px] text-muted uppercase tracking-wider">
          {WEATHER_CODES[weather_code] || "Unknown"}
        </span>
        <div className="text-[8px] text-muted flex gap-2 mt-0.5">
          <span>{wind_speed_10m}km/h</span>
          <span>{relative_humidity_2m}%</span>
        </div>
      </div>
    </WidgetCard>
  );
}
