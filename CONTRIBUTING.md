# Contributing

Thanks for your interest in contributing! The easiest way to contribute is by adding a new widget.

## Adding a Widget

There are 3 steps: create the component, register it, and wire it into the grid.

### 1. Create the Component

Create a new file in `components/` named `YourWidget.tsx`.

Every widget must:
- Be a client component (`"use client"`)
- Wrap its content in `<WidgetCard title="...">` for consistent styling
- Handle hydration — show a placeholder until mounted (avoid SSR mismatches)

Here's a minimal example:

```tsx
// components/ExampleWidget.tsx
"use client";

import { useState, useEffect } from "react";
import WidgetCard from "./WidgetCard";

export default function ExampleWidget() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <WidgetCard title="Example">
        <div className="flex items-center justify-center h-full text-muted">
          Loading...
        </div>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard title="Example">
      <div className="flex items-center justify-center h-full">
        <span className="text-green">Hello, world!</span>
      </div>
    </WidgetCard>
  );
}
```

### 2. Register the Widget

Add an entry to `WIDGET_REGISTRY` in `lib/widget-registry.ts`:

```ts
{ id: "example", name: "Example", size: "normal", description: "A short description" },
```

**Widget sizes:**

| Size | Behavior |
|------|----------|
| `"normal"` | Takes a full grid cell. Use for widgets with rich content. |
| `"mini"` | Grouped into a 2-column sub-grid with other minis. Good for small displays (clock, score, etc). |
| `"mini-wide"` | Takes 2 columns within the mini sub-grid. Use `className="col-span-2"` on your `WidgetCard`. |

If you want the widget enabled by default, also add its `id` to the `DEFAULT_LAYOUT` array in the same file.

### 3. Wire It Into the Grid

In `components/DashboardGrid.tsx`, add two things:

**Import your component:**
```ts
import ExampleWidget from "./ExampleWidget";
```

**Add it to the component map:**
```ts
const WIDGET_COMPONENTS: Record<string, React.ComponentType> = {
  // ... existing widgets
  example: ExampleWidget,
};
```

The key must match the `id` you used in the registry. That's it — the grid and widget pane handle the rest automatically.

## Design Guidelines

Follow these to keep your widget consistent with the rest of the dashboard.

### Colors

Use the theme's CSS variables / Tailwind classes:

| Use | Class / Value |
|-----|---------------|
| Primary text | `text-foreground` (white) |
| Secondary text | `text-muted` (gray) |
| Accent | `text-green` (`#00ff41`) |
| Warning | `text-amber` (`#ffaa00`) |
| Alert | `text-red` (`#ff3333`) |
| Background | `bg-surface` (`#111111`) |
| Borders | `border-border` (`#1a1a1a`) |

### Typography

- Font is JetBrains Mono (monospace) everywhere — no need to set it per widget
- Use `text-[10px] uppercase tracking-[0.2em]` for labels
- Use `text-[8px] text-muted` for secondary info
- Use `tabular-nums` on any numbers that update frequently (prevents layout shift)

### No External Chart Libraries

Bars, gauges, and sparklines should be built with plain divs or inline SVG. For example, a percentage bar:

```tsx
<div className="h-1 bg-border rounded-full overflow-hidden">
  <div className="h-full bg-green" style={{ width: `${percent}%` }} />
</div>
```

## Persisting Data

Use `localStorage` for any data your widget needs to persist. Follow the naming convention:

```
sm-your-widget-key
```

Use the `useLocalStorage` hook from `hooks/useLocalStorage.ts` for an SSR-safe wrapper:

```ts
const [data, setData] = useLocalStorage<MyType>("sm-example-data", defaultValue);
```

## Cross-Widget Communication

Widgets can broadcast messages via the status ticker:

```ts
window.dispatchEvent(
  new CustomEvent("ticker-message", {
    detail: { text: "Something happened!", type: "info" },
  })
);
```

The `type` field can be `"info"`, `"success"`, `"warning"`, or `"error"`.

## Adding an API Route

If your widget needs to call an external API, create a proxy route under `app/api/`:

```
app/api/your-service/route.ts
```

This keeps API keys server-side and avoids CORS issues. Add any new env vars to `.env.example` with a comment explaining how to get them.

## Running Locally

```bash
npm install
cp .env.example .env.local  # fill in your values
npm run dev                  # http://localhost:3000
```
