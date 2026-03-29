"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

type SpriteFrame = readonly string[];

type CharacterDefinition = {
  id: string;
  palette: Record<string, string>;
  frames: readonly [SpriteFrame, SpriteFrame];
  quotes: readonly string[];
  duration: number;
  delay: number;
  bottom: number;
  scale?: number;
};

const FLOW_CHARACTERS: CharacterDefinition[] = [
  {
    id: "robot",
    palette: {
      x: "#1a2639",
      d: "#5b7b91",
      m: "#93b8c4",
      l: "#c7d5de",
      e: "#00ffcc",
      a: "#ff3366",
    },
    frames: [
      [
        ".....xa.....",
        "....xamx....",
        "...xxxxxx...",
        "..xllllllx..",
        ".xlmmmmmmlx.",
        ".xleemmeelx.",
        ".xlmmmmmmlx.",
        "..xddddddx..",
        ".xmdmmmmdmx.",
        "xmmx....xmmx",
        ".xx......xx.",
        "............",
      ],
      [
        ".....xa.....",
        "....xamx....",
        "...xxxxxx...",
        "..xllllllx..",
        ".xlmmmmmmlx.",
        ".xleemmeelx.",
        ".xlmmmmmmlx.",
        "..xddddddx..",
        ".xmdmmmmdmx.",
        ".xmx.xx.xmx.",
        ".xx......xx.",
        "............",
      ],
    ],
    quotes: [
      "You got this",
      "Tiny steps, big win",
      "Systems are go",
      "Keep moving",
    ],
    duration: 18,
    delay: -2,
    bottom: 7,
    scale: 1.05,
  },
  {
    id: "warrior",
    palette: {
      x: "#2d1b11",
      s: "#ffcc99",
      d: "#8f5339",
      m: "#d6a24d",
      l: "#ffe2b5",
      h: "#ff5555",
      w: "#dddddd",
    },
    frames: [
      [
        "....xx......",
        "...xhhx.....",
        "..xmmmmx....",
        ".xllllllx...",
        ".xmxssxmx...",
        ".xmmmmmmx...",
        "..xddddx....",
        ".xmdmmdmx.w.",
        "xmmddddmmxw.",
        "..xd..dx..w.",
        ".xx....xx...",
        "............",
      ],
      [
        "....xx......",
        "...xhhx.....",
        "..xmmmmx....",
        ".xllllllx...",
        ".xmxssxmx...",
        ".xmmmmmmx...",
        "..xddddx....",
        ".xmdmmdmx.w.",
        "xmmddddmmxw.",
        "...xddx...w.",
        "...xx.xx....",
        "............",
      ],
    ],
    quotes: [
      "Forward",
      "Keep your streak",
      "One more rep",
      "You are locked in",
    ],
    duration: 22,
    delay: -9,
    bottom: 8,
    scale: 1.08,
  },
  {
    id: "dog",
    palette: {
      x: "#2a1b15",
      d: "#a85d36",
      m: "#d98243",
      l: "#f5d3ab",
      p: "#ff99aa",
    },
    frames: [
      [
        "............",
        ".......dx...",
        "..x...xmpx..",
        ".xmx.xllmmx.",
        ".xmx.xxlmx..",
        ".xmx.xxllllmx",
        ".xmmmmmmmmx.",
        ".xmmmmmxxmx.",
        "..xmx...mx..",
        "...xx...xx..",
        "............",
        "............",
      ],
      [
        "............",
        ".......dx...",
        "......xmpx..",
        "..x..xllmmx.",
        ".xmx.xxlmx..",
        ".xmx.xxllllmx",
        ".xmmmmmmmmx.",
        ".xmmmmmxxmx.",
        ".xmx...mx...",
        "..xx...xx...",
        "............",
        "............",
      ],
    ],
    quotes: [
      "Good job human",
      "Stay with it",
      "One task at a time",
      "Proud of you",
    ],
    duration: 16,
    delay: -5,
    bottom: 4,
    scale: 0.98,
  },
  {
    id: "wizard",
    palette: {
      x: "#1e1e2e",
      d: "#585b95",
      m: "#8ca3d4",
      l: "#ffffff",
      s: "#ffcc99",
      w: "#8f563b",
      g: "#f5d764",
    },
    frames: [
      [
        ".....xx.....",
        "....xddx....",
        "...xgddgx...",
        "..xddddddx..",
        "..xssssssx..",
        "...xsxxsx...",
        "...xllllx...",
        "..xddddddx.w",
        ".xmddddddmxg",
        ".xmmddddmmxw",
        ".xmxxxxxxmxw",
        ".xx......xx.",
      ],
      [
        ".....xx.....",
        "....xddx....",
        "...xgddgx...",
        "..xddddddx..",
        "..xssssssx..",
        "...xsxxsx...",
        "...xllllx...",
        "..xddddddx.w",
        ".xmddddddmxg",
        ".xmmddddmmxw",
        "..xmdxxdmx.w",
        "..xx..xx....",
      ],
    ],
    quotes: [
      "Momentum is magic",
      "Small steps cast big spells",
      "Stay in the flow",
      "You are doing great",
    ],
    duration: 24,
    delay: -14,
    bottom: 6,
  },
  {
    id: "cat",
    palette: {
      x: "#1a1a24",
      w: "#ffffff",
      o: "#ff9933",
      p: "#ff99aa",
    },
    frames: [
      [
        "............",
        "..xox..xox..",
        ".xopx..xpox.",
        "xoooxxxooox.",
        "xooooooooox.",
        "xowowoowowx.",
        "xooooooooox.",
        ".xoxxpoxxox.",
        "..xooooxx...",
        "...xxxxoox..",
        "....xooox...",
        "....xxxxx...",
      ],
      [
        "............",
        "..xox..xox..",
        ".xopx..xpox.",
        "xoooxxxooox.",
        "xooooooooox.",
        "xowowoowowx.",
        "xooooooooox.",
        ".xoxxpoxxox.",
        "..xooooxx...",
        "...xxxxoox..",
        "....xxxx....",
        "....xooox...",
      ],
    ],
    quotes: [
      "Meow.",
      "Purrfect work",
      "Keep scratching at it",
      "Time for a nap later",
    ],
    duration: 20,
    delay: -7,
    bottom: 5,
    scale: 1.0,
  },
  {
    id: "ghost",
    palette: {
      x: "#1c1c30",
      w: "#f0f0ff",
      p: "#ffb3c6",
    },
    frames: [
      [
        "....xxxx....",
        "..xxwwwwxx..",
        ".xwwwwwwwwx.",
        ".xwxxwwxxwx.",
        "xwwwwwwwwwwx",
        "xwpxwwwwxpwx",
        "xwwwwwwwwwwx",
        "xwwwwwwwwwwx",
        "xwwwwwwwwwwx",
        "xwxwxwwxwxwx",
        ".x.x.xx.x.x.",
        "............",
      ],
      [
        "....xxxx....",
        "..xxwwwwxx..",
        ".xwwwwwwwwx.",
        ".xwxxwwxxwx.",
        "xwwwwwwwwwwx",
        "xwpxwwwwxpwx",
        "xwwwwwwwwwwx",
        "xwwwwwwwwwwx",
        "xwwwwwwwwwwx",
        ".xwxwwxwxwx.",
        "..x.xx.x.x..",
        "............",
      ],
    ],
    quotes: [
      "Boo! Just kidding",
      "Floating through tasks",
      "You're doing scary good",
      "I'm right behind you",
    ],
    duration: 26,
    delay: -4,
    bottom: 12,
    scale: 1.05,
  },
  {
    id: "alien",
    palette: {
      x: "#0d2618",
      g: "#5cd67c",
      d: "#2a8a44",
      b: "#1a1a24",
      s: "#d0d0f0",
    },
    frames: [
      [
        "....xxxx....",
        "...xggggx...",
        "..xggddggx..",
        ".xgbbggbbgx.",
        ".xggbggbggx.",
        ".xggggggggx.",
        "..xggggggx..",
        "...xssssx...",
        "..xssssssx..",
        ".xssxxxxssx.",
        ".xx..xx..xx.",
        "............",
      ],
      [
        "....xxxx....",
        "...xggggx...",
        "..xggddggx..",
        ".xgbbggbbgx.",
        ".xggbggbggx.",
        ".xggggggggx.",
        "..xggggggx..",
        "...xssssx...",
        "..xssssssx..",
        ".xssxxxxssx.",
        "..xx....xx..",
        "............",
      ],
    ],
    quotes: [
      "Take me to your leader",
      "Greetings earthling",
      "Stellar progress",
      "Out of this world",
    ],
    duration: 19,
    delay: -11,
    bottom: 5,
    scale: 0.95,
  },
  {
    id: "ninja",
    palette: {
      x: "#111116",
      d: "#2a2a35",
      s: "#ffe2b5",
      r: "#cc2233",
      w: "#eeeeee",
    },
    frames: [
      [
        "....xxxx....",
        "...xddddx...",
        "..xssssssx..",
        ".xssxxssxxs.",
        "..xssssssx..",
        "...xrrrrx...",
        "..xddddddx.w",
        ".xddddddddxw",
        ".xddddddddxw",
        "..xddrrddx.w",
        "..xddxxddx..",
        "..xx...xx...",
      ],
      [
        "....xxxx....",
        "...xddddx...",
        "..xssssssx..",
        ".xssxxssxxs.",
        "..xssssssx..",
        "...xrrrrx...",
        "..xddddddx.w",
        ".xddddddddxw",
        ".xddddddddxw",
        "..xddrrddx.w",
        "...xdxxdx...",
        "...xx..xx...",
      ],
    ],
    quotes: [
      "Stealth mode activated",
      "Silent but productive",
      "Focus your mind",
      "Swift and precise",
    ],
    duration: 17,
    delay: -1,
    bottom: 7,
    scale: 1.0,
  },
  {
    id: "dino",
    palette: {
      x: "#173322",
      g: "#66cc88",
      l: "#99eeaa",
      d: "#339955",
      w: "#ffffff",
    },
    frames: [
      [
        ".......xdx..",
        "......xggx..",
        ".....xwgxx..",
        "..xdxggggx..",
        ".xggxggggx..",
        "xggggggggx..",
        "xgwwwwwwgx..",
        ".xgwwwwgx...",
        "..xgggx.xx..",
        "..xgxgx.xx..",
        "..xxxxx.....",
        "............",
      ],
      [
        ".......xdx..",
        "......xggx..",
        ".....xwgxx..",
        "..xdxggggx..",
        ".xggxggggx..",
        "xggggggggx..",
        "xgwwwwwwgx..",
        ".xgwwwwgx...",
        "..xgggx.xx..",
        "..x.xxx.xx..",
        "..xxxxx.....",
        "............",
      ],
    ],
    quotes: [
      "Rawr!",
      "Dino-mite work",
      "Stomping through bugs",
      "Prehistoric productivity",
    ],
    duration: 21,
    delay: -8,
    bottom: 4,
    scale: 1.1,
  },
  {
    id: "astronaut",
    palette: {
      x: "#1e1e2d",
      w: "#eeeeff",
      b: "#4477dd",
      l: "#88bbff",
      r: "#ff4455",
    },
    frames: [
      [
        "....xxxx....",
        "..xwwwwwx...",
        "x.xwbbbbwx..",
        "xxwbbllbwwx.",
        "xxwbbbbbwwx.",
        "x.xwwwwwwx..",
        ".r.xwwwwx...",
        ".rxwwwrwwx..",
        ".xwwwwwwwwx.",
        ".xwwxwwxwwx.",
        "..xx.xx.xx..",
        "............",
      ],
      [
        "....xxxx....",
        "..xwwwwwx...",
        "x.xwbbbbwx..",
        "xxwbbllbwwx.",
        "xxwbbbbbwwx.",
        "x.xwwwwwwx..",
        ".r.xwwwwx...",
        ".rxwwwrwwx..",
        ".xwwwwwwwwx.",
        ".xwwxwwxwwx.",
        "...x.xx.x...",
        "...xx..xx...",
      ],
    ],
    quotes: [
      "Houston, we have progress",
      "One small step",
      "Reaching for the stars",
      "Mission control is proud",
    ],
    duration: 25,
    delay: -12,
    bottom: 8,
    scale: 1.05,
  },
];

const FLOW_PIXEL_SIZE = 4;
const FLOW_LANE_PADDING = 36;
const FLOW_TICK_MS = 120;

type WalkerMotion = {
  id: string;
  direction: 1 | -1;
  x: number;
};

function getSpriteMetrics(
  frames: readonly [SpriteFrame, SpriteFrame],
  scale = 1
) {
  const cols = Math.max(...frames.flatMap((frame) => frame.map((row) => row.length)));
  const rows = Math.max(...frames.map((frame) => frame.length));

  return {
    cols,
    rows,
    widthPx: cols * FLOW_PIXEL_SIZE * scale,
    heightPx: rows * FLOW_PIXEL_SIZE * scale,
  };
}

function normalizeSpriteScale(scale = 1) {
  return Math.max(0.75, Math.round(FLOW_PIXEL_SIZE * scale) / FLOW_PIXEL_SIZE);
}

const CHARACTER_METRICS = new Map(
  FLOW_CHARACTERS.map((character) => {
    const renderScale = normalizeSpriteScale(character.scale ?? 1);

    return [
      character.id,
      {
        ...getSpriteMetrics(character.frames, renderScale),
        renderScale,
        speed: Math.max(1.5, 40 / character.duration),
      },
    ];
  })
);

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function createInitialWalkerMotions(laneWidth: number): WalkerMotion[] {
  return FLOW_CHARACTERS.map((character, index) => {
    const metrics = CHARACTER_METRICS.get(character.id);

    if (!metrics) {
      return {
        id: character.id,
        direction: 1,
        x: FLOW_LANE_PADDING,
      };
    }

    const maxX = Math.max(FLOW_LANE_PADDING, laneWidth - metrics.widthPx - FLOW_LANE_PADDING);
    const spread = FLOW_CHARACTERS.length > 1 ? index / (FLOW_CHARACTERS.length - 1) : 0.5;

    return {
      id: character.id,
      direction: index % 2 === 0 ? 1 : -1,
      x: FLOW_LANE_PADDING + (maxX - FLOW_LANE_PADDING) * spread,
    };
  });
}

function PixelSprite({
  frames,
  palette,
}: {
  frames: readonly [SpriteFrame, SpriteFrame];
  palette: Record<string, string>;
}) {
  const width = Math.max(...frames.flatMap((frame) => frame.map((row) => row.length)));
  const height = Math.max(...frames.map((frame) => frame.length));

  const renderFrame = (frame: SpriteFrame, frameClassName: string) => (
    <div
      className={frameClassName}
      style={{
        gridTemplateColumns: `repeat(${width}, var(--flow-pixel-size))`,
        gridTemplateRows: `repeat(${height}, var(--flow-pixel-size))`,
      }}
    >
      {Array.from({ length: height }, (_, rowIndex) =>
        Array.from({ length: width }, (_, columnIndex) => {
          const pixel = frame[rowIndex]?.[columnIndex] ?? ".";
          return (
            <span
              key={`${rowIndex}-${columnIndex}`}
              className="flow-sprite__pixel"
              data-filled={pixel !== "." || undefined}
              style={
                pixel === "."
                  ? undefined
                  : ({ backgroundColor: palette[pixel] } as CSSProperties)
              }
            />
          );
        })
      )}
    </div>
  );

  return (
    <div
      className="flow-sprite"
      style={{
        width: `calc(${width} * var(--flow-pixel-size))`,
        height: `calc(${height} * var(--flow-pixel-size))`,
      }}
    >
      {renderFrame(frames[0], "flow-sprite__frame flow-sprite__frame--primary")}
      {renderFrame(frames[1], "flow-sprite__frame flow-sprite__frame--secondary")}
    </div>
  );
}

export default function FlowCharacterLane() {
  const laneRef = useRef<HTMLDivElement | null>(null);
  const [laneWidth, setLaneWidth] = useState(0);
  const [activeBubble, setActiveBubble] = useState<{
    id: string;
    quote: string;
  } | null>(null);
  const [walkerMotions, setWalkerMotions] = useState<WalkerMotion[]>(() =>
    createInitialWalkerMotions(960)
  );

  useEffect(() => {
    const node = laneRef.current;
    if (!node) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? node.clientWidth;
      setLaneWidth(nextWidth);
    });
    resizeObserver.observe(node);

    const frame = requestAnimationFrame(() => {
      setLaneWidth(node.clientWidth);
    });

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    let characterIndex = 0;
    const quoteIndices = new Map(FLOW_CHARACTERS.map((character) => [character.id, 0]));
    let showTimer: ReturnType<typeof setTimeout> | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    let loopTimer: ReturnType<typeof setTimeout> | null = null;

    const showNextBubble = () => {
      const character = FLOW_CHARACTERS[characterIndex];
      const quoteIndex = quoteIndices.get(character.id) ?? 0;
      const quote = character.quotes[quoteIndex % character.quotes.length];

      setActiveBubble({ id: character.id, quote });

      quoteIndices.set(character.id, (quoteIndex + 1) % character.quotes.length);
      characterIndex = (characterIndex + 1) % FLOW_CHARACTERS.length;

      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        setActiveBubble((current) => (current?.id === character.id ? null : current));
      }, 6500);

      loopTimer = setTimeout(showNextBubble, 30000);
    };

    showTimer = setTimeout(showNextBubble, 7000);

    return () => {
      if (showTimer) clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
      if (loopTimer) clearTimeout(loopTimer);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const activeLaneWidth = laneWidth || 960;

      setWalkerMotions((previous) => {
        return previous.map((walker) => {
          const metrics = CHARACTER_METRICS.get(walker.id);
          if (!metrics) return walker;

          const minX = FLOW_LANE_PADDING;
          const maxX = Math.max(minX, activeLaneWidth - metrics.widthPx - FLOW_LANE_PADDING);

          const nextX = walker.x + walker.direction * metrics.speed;
          if (nextX <= minX || nextX >= maxX) {
            const nextDirection: 1 | -1 = walker.direction === 1 ? -1 : 1;
            return {
              ...walker,
              direction: nextDirection,
              x: clamp(nextX, minX, maxX),
            };
          }

          return {
            ...walker,
            x: nextX,
          };
        });
      });
    }, FLOW_TICK_MS);

    return () => clearInterval(interval);
  }, [laneWidth]);

  const activeLaneWidth = laneWidth || 960;
  const motionsById = new Map(walkerMotions.map((walker) => [walker.id, walker]));

  return (
    <div ref={laneRef} className="flow-lane" aria-hidden="true">
      <div className="flow-lane__ground" />
      {FLOW_CHARACTERS.map((character) => (
        (() => {
          const motion = motionsById.get(character.id);
          if (!motion) return null;
          const metrics = CHARACTER_METRICS.get(character.id);
          const renderX = metrics
            ? clamp(
                motion.x,
                FLOW_LANE_PADDING,
                Math.max(FLOW_LANE_PADDING, activeLaneWidth - metrics.widthPx - FLOW_LANE_PADDING)
              )
            : motion.x;

          return (
            <div
              key={character.id}
              className="flow-walker"
              style={
                {
                  "--flow-bottom": `${character.bottom}px`,
                  "--flow-facing": motion.direction,
                  "--flow-scale": metrics?.renderScale ?? 1,
                  transform: `translateX(${renderX}px)`,
                } as CSSProperties
              }
            >
              {activeBubble?.id === character.id ? (
                <div className="flow-bubble">
                  <span className="flow-bubble__text">{activeBubble.quote}</span>
                </div>
              ) : null}
              <div className="flow-walker__shadow" />
              <div className="flow-walker__body">
                <PixelSprite frames={character.frames} palette={character.palette} />
              </div>
            </div>
          );
        })()
      ))}
    </div>
  );
}
