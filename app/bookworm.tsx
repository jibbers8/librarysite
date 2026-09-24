"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

/*
 * Bookworm: a pixel snake clone. The worm wears reading glasses, its body is a
 * train of tiny cloth-bound books, and every book it eats joins the train.
 * Drawn at 8 px per cell on a 104 px canvas and scaled up 3x with hard edges.
 */

const GRID = 13;
const CELL = 8;
const SIZE = GRID * CELL;
const BASE_TICK_MS = 140;
const MIN_TICK_MS = 70;
const BEST_KEY = "bookworm-best";

type Dir = { x: number; y: number };
type Cell = { x: number; y: number };
type Cloth = { C: string; L: string; D: string };
type Status = "ready" | "playing" | "paused" | "over";

const UP: Dir = { x: 0, y: -1 };
const DOWN: Dir = { x: 0, y: 1 };
const LEFT: Dir = { x: -1, y: 0 };
const RIGHT: Dir = { x: 1, y: 0 };

// A fixed palette drawn from the site's bindings, paper and ink.
const PAL = {
  O: "#2a2620", // ink outline
  G: "#e4c878", // gilt
  P: "#efe8d6", // paper
  W: "#d98a7e", // worm
  w: "#b0655b", // worm shade
  h: "#fff7e0", // lens glint
  boardA: "#efe8d6",
  boardB: "#e6dec8",
};

const CLOTHS: Cloth[] = [
  { C: "#1f4a39", L: "#2f6b53", D: "#143226" },
  { C: "#6d1f2c", L: "#8f3444", D: "#4a1420" },
  { C: "#233360", L: "#34498a", D: "#172242" },
  { C: "#7d6420", L: "#a88a36", D: "#574514" },
];

// 8x8 sprites. "." is transparent; C/L/D take the book's cloth colours.
const HEAD_RIGHT = [
  ".OOOOO..",
  "OWWWWWO.",
  "OWWWWWWO",
  "OWOhWOhO",
  "OWOOOOOO",
  "OWWWWWWO",
  "OwwwwwO.",
  ".OOOOO..",
];

const BOOK_LYING = [
  ".OOOOOO.",
  "OLLLLLLO",
  "OCGCCGCO",
  "OCGCCGCO",
  "OCGCCGCO",
  "OCGCCGCO",
  "ODDDDDDO",
  ".OOOOOO.",
];

const BOOK_STANDING = [
  ".OOOOOO.",
  ".OLCCCO.",
  ".OGGGGO.",
  ".OCPPCO.",
  ".OCPPCO.",
  ".OGGGGO.",
  ".ODDDDO.",
  ".OOOOOO.",
];

function rotateCW(sprite: string[]) {
  return sprite.map((_, y) => sprite.map((row) => row[y]).reverse().join(""));
}

function mirror(sprite: string[]) {
  return sprite.map((row) => row.split("").reverse().join(""));
}

const HEADS = {
  right: HEAD_RIGHT,
  down: rotateCW(HEAD_RIGHT),
  left: mirror(HEAD_RIGHT),
  up: rotateCW(rotateCW(rotateCW(HEAD_RIGHT))),
};
const BOOK_UPRIGHT_SEGMENT = rotateCW(BOOK_LYING);

function drawSprite(ctx: CanvasRenderingContext2D, sprite: string[], cell: Cell, cloth?: Cloth) {
  for (let y = 0; y < CELL; y += 1) {
    for (let x = 0; x < CELL; x += 1) {
      const key = sprite[y][x];
      if (key === ".") {
        continue;
      }
      const color =
        cloth && (key === "C" || key === "L" || key === "D") ? cloth[key] : PAL[key as keyof typeof PAL];
      ctx.fillStyle = color;
      ctx.fillRect(cell.x * CELL + x, cell.y * CELL + y, 1, 1);
    }
  }
}

function randomCloth() {
  return CLOTHS[Math.floor(Math.random() * CLOTHS.length)];
}

function headSprite(dir: Dir) {
  if (dir.x === 1) return HEADS.right;
  if (dir.x === -1) return HEADS.left;
  if (dir.y === 1) return HEADS.down;
  return HEADS.up;
}

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function readBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value: number) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be unavailable (private mode); the best score just won't persist.
  }
}

type Game = {
  snake: Cell[];
  cloths: Cloth[]; // cloths[i] colours body segment i + 1
  dir: Dir;
  queue: Dir[];
  food: Cell & { cloth: Cloth };
  score: number;
};

function placeFood(snake: Cell[]): Game["food"] {
  const taken = new Set(snake.map((c) => `${c.x},${c.y}`));
  const free: Cell[] = [];
  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      if (!taken.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  const spot = free[Math.floor(Math.random() * free.length)] ?? { x: 0, y: 0 };
  return { ...spot, cloth: randomCloth() };
}

function newGame(): Game {
  const mid = Math.floor(GRID / 2);
  const snake = [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
  ];
  return {
    snake,
    cloths: [randomCloth(), randomCloth()],
    dir: RIGHT,
    queue: [],
    food: placeFood(snake),
    score: 0,
  };
}

type BookwormState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  best: number;
  setBest: (best: number) => void;
  panelId: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
};

const BookwormContext = createContext<BookwormState | null>(null);

function useBookworm() {
  const state = useContext(BookwormContext);
  if (!state) throw new Error("Bookworm parts must be inside <BookwormProvider>.");
  return state;
}

/** Shares open state between the worm in the header and the game drawer. */
export function BookwormProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [best, setBest] = useState(0);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <BookwormContext.Provider value={{ open, setOpen, best, setBest, panelId, triggerRef }}>
      {children}
    </BookwormContext.Provider>
  );
}

// The idle inchworm, 20x10 pixels: flat, then arched mid-inch. H is highlight, E the pupil.
const WORM_FLAT_MAP = [
  "....................",
  "..............OOOO..",
  ".............OHHHHO.",
  ".............OWOOOOO",
  "..OOOOOOOOOOOOWOhEOO",
  ".OHHHHHHHHHHHHWOOOOO",
  "OWWWWWWWWWWWWWWWWWWO",
  "OwWWwWWwWWwWWwWWWOWO",
  ".OwwwwwwwwwwwwwwwwO.",
  "..OOOOOOOOOOOOOOOO..",
];

const WORM_ARCHED_MAP = [
  "......OOOOO.........",
  ".....OHHHHHO..OOOO..",
  "....OHWWWWWHOOHHHHO.",
  "...OWWO...OWWOWOOOOO",
  "...OWWO...OWWWWOhEOO",
  "..OHWWO...OWWWWOOOOO",
  "..OWWWO...OWWWWWWWWO",
  "..OwWwO...OwWwWWWOWO",
  "..OwwwO...OwwwwwwwO.",
  "...OOO.....OOOOOOO..",
];

const WORM_COLORS: Record<string, string> = {
  O: PAL.O,
  W: PAL.W,
  w: PAL.w,
  H: "#f2b6a8",
  h: PAL.h,
  E: PAL.O,
};

function mapPixels(map: string[]) {
  const px: Array<[number, number, string]> = [];
  map.forEach((row, y) =>
    row.split("").forEach((key, x) => {
      if (key !== ".") px.push([x, y, WORM_COLORS[key]]);
    }),
  );
  return px;
}

const WORM_FLAT = mapPixels(WORM_FLAT_MAP);
const WORM_ARCHED = mapPixels(WORM_ARCHED_MAP);

/** A little pixel inchworm; clicking it opens the game. */
export function BookwormTrigger() {
  const { open, setOpen, setBest, best, panelId, triggerRef } = useBookworm();
  return (
    <button
      aria-controls={panelId}
      aria-expanded={open}
      aria-label="Play Bookworm"
      className="stx-inchworm"
      onClick={() => {
        if (!open) setBest(Math.max(best, readBest()));
        setOpen(!open);
      }}
      ref={triggerRef}
      type="button"
    >
      <span aria-hidden className="stx-inchworm__bubble">
        Play?
      </span>
      <svg aria-hidden className="stx-inchworm__sprite" shapeRendering="crispEdges" viewBox="0 0 20 10">
        <g className="stx-inchworm__flat">
          {WORM_FLAT.map(([x, y, fill]) => (
            <rect fill={fill} height="1" key={`f${x}-${y}`} width="1" x={x} y={y} />
          ))}
        </g>
        <g className="stx-inchworm__arched">
          {WORM_ARCHED.map(([x, y, fill]) => (
            <rect fill={fill} height="1" key={`a${x}-${y}`} width="1" x={x} y={y} />
          ))}
        </g>
      </svg>
    </button>
  );
}

export function Bookworm() {
  const { open, setOpen, best, setBest, panelId, triggerRef } = useBookworm();
  const [status, setStatus] = useState<Status>("ready");
  const [score, setScore] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game>(newGame());
  const statusRef = useRef<Status>("ready");
  const timerRef = useRef<number | undefined>(undefined);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const game = gameRef.current;

    for (let y = 0; y < GRID; y += 1) {
      for (let x = 0; x < GRID; x += 1) {
        ctx.fillStyle = (x + y) % 2 === 0 ? PAL.boardA : PAL.boardB;
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }

    drawSprite(ctx, BOOK_STANDING, game.food, game.food.cloth);

    for (let i = game.snake.length - 1; i >= 1; i -= 1) {
      const segment = game.snake[i];
      const ahead = game.snake[i - 1];
      const sprite = ahead.y === segment.y ? BOOK_LYING : BOOK_UPRIGHT_SEGMENT;
      drawSprite(ctx, sprite, segment, game.cloths[i - 1]);
    }
    drawSprite(ctx, headSprite(game.dir), game.snake[0]);
  }, []);

  const setStatusBoth = useCallback((next: Status) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const stopLoop = useCallback(() => {
    window.clearTimeout(timerRef.current);
  }, []);

  const endGame = useCallback(() => {
    stopLoop();
    setStatusBoth("over");
    const final = gameRef.current.score;
    const previous = Math.max(best, readBest());
    setNewBest(final > previous);
    if (final > previous) {
      saveBest(final);
      setBest(final);
    }
  }, [best, setBest, setStatusBoth, stopLoop]);

  const step = useCallback(() => {
    const game = gameRef.current;
    const next = game.queue.shift();
    if (next) game.dir = next;

    const head = game.snake[0];
    const moved = { x: head.x + game.dir.x, y: head.y + game.dir.y };
    const eats = moved.x === game.food.x && moved.y === game.food.y;
    const body = eats ? game.snake : game.snake.slice(0, -1);

    const hitsWall = moved.x < 0 || moved.y < 0 || moved.x >= GRID || moved.y >= GRID;
    const hitsSelf = body.some((c) => c.x === moved.x && c.y === moved.y);
    if (hitsWall || hitsSelf) {
      draw();
      endGame();
      return false;
    }

    game.snake = [moved, ...body];
    if (eats) {
      game.cloths.push(game.food.cloth);
      game.score += 1;
      setScore(game.score);
      game.food = placeFood(game.snake);
    }
    draw();
    return true;
  }, [draw, endGame]);

  const runLoop = useCallback(() => {
    stopLoop();
    const tick = () => {
      if (statusRef.current !== "playing") return;
      if (!step()) return;
      const delay = Math.max(MIN_TICK_MS, BASE_TICK_MS - gameRef.current.score * 3);
      timerRef.current = window.setTimeout(tick, delay);
    };
    timerRef.current = window.setTimeout(tick, BASE_TICK_MS);
  }, [step, stopLoop]);

  const start = useCallback(() => {
    gameRef.current = newGame();
    setScore(0);
    draw();
    setStatusBoth("playing");
    runLoop();
  }, [draw, runLoop, setStatusBoth]);

  const togglePause = useCallback(() => {
    if (statusRef.current === "playing") {
      stopLoop();
      setStatusBoth("paused");
    } else if (statusRef.current === "paused") {
      setStatusBoth("playing");
      runLoop();
    }
  }, [runLoop, setStatusBoth, stopLoop]);

  const steer = useCallback(
    (dir: Dir) => {
      if (statusRef.current === "ready" || statusRef.current === "over") {
        start();
      }
      if (statusRef.current === "paused") {
        togglePause();
      }
      const game = gameRef.current;
      const last = game.queue[game.queue.length - 1] ?? game.dir;
      const reverses = last.x === -dir.x && last.y === -dir.y;
      const same = last.x === dir.x && last.y === dir.y;
      if (!reverses && !same && game.queue.length < 2) {
        game.queue.push(dir);
      }
    },
    [start, togglePause],
  );

  const close = useCallback(() => {
    setOpen(false);
    if (statusRef.current === "playing") {
      stopLoop();
      setStatusBoth("paused");
    }
    triggerRef.current?.focus();
  }, [setOpen, setStatusBoth, stopLoop, triggerRef]);

  useEffect(() => {
    draw();
    return () => window.clearTimeout(timerRef.current);
  }, [draw]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();

    const keys: Record<string, Dir> = {
      ArrowUp: UP,
      ArrowDown: DOWN,
      ArrowLeft: LEFT,
      ArrowRight: RIGHT,
      w: UP,
      s: DOWN,
      a: LEFT,
      d: RIGHT,
    };

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
        return;
      }
      const dir = keys[event.key] ?? keys[event.key.toLowerCase()];
      if (dir) {
        event.preventDefault();
        steer(dir);
        return;
      }
      if (event.key === " ") {
        event.preventDefault();
        if (statusRef.current === "ready" || statusRef.current === "over") start();
        else togglePause();
      }
    }

    function handleVisibility() {
      if (document.hidden && statusRef.current === "playing") togglePause();
    }

    window.addEventListener("keydown", handleKey);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [open, close, start, steer, togglePause]);

  function handlePointerDown(event: React.PointerEvent) {
    swipeRef.current = { x: event.clientX, y: event.clientY };
  }

  function handlePointerUp(event: React.PointerEvent) {
    const origin = swipeRef.current;
    swipeRef.current = null;
    if (!origin) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) {
      if (statusRef.current === "playing" || statusRef.current === "paused") togglePause();
      else start();
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) steer(dx > 0 ? RIGHT : LEFT);
    else steer(dy > 0 ? DOWN : UP);
  }

  const announcement =
    status === "over"
      ? `Overdue. ${score} ${score === 1 ? "book" : "books"} eaten.`
      : status === "paused"
        ? "Paused."
        : "";

  return (
    <>
      <div
        aria-label="Bookworm game"
        className="stx-worm"
        data-open={open || undefined}
        id={panelId}
        inert={!open}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="stx-worm__bar">
          <span>Books {pad(score)}</span>
          <span>Best {pad(best)}</span>
        </div>

        <div className="stx-worm__screen">
          <canvas
            aria-label="Bookworm board"
            className="stx-worm__canvas"
            height={SIZE}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            ref={canvasRef}
            role="img"
            width={SIZE}
          />

          {status === "ready" && (
            <div className="stx-worm__overlay">
              <p className="stx-worm__title">Bookworm</p>
              <p>Eat the books. Don&rsquo;t bite your own spine.</p>
              <p className="stx-worm__blink">Press space or tap</p>
            </div>
          )}
          {status === "paused" && (
            <div className="stx-worm__overlay">
              <p className="stx-worm__title">Paused</p>
              <p className="stx-worm__blink">Space or tap to resume</p>
            </div>
          )}
          {status === "over" && (
            <div className="stx-worm__overlay">
              <p className="stx-worm__stamp">Overdue</p>
              <p>
                {score} {score === 1 ? "book" : "books"} eaten
                {newBest ? ". New best!" : ""}
              </p>
              <p className="stx-worm__blink">Space or tap to retry</p>
            </div>
          )}
        </div>

        <div aria-label="Direction pad" className="stx-worm__pad" role="group">
          <button aria-label="Up" onClick={() => steer(UP)} type="button">
            ▲
          </button>
          <button aria-label="Left" onClick={() => steer(LEFT)} type="button">
            ◀
          </button>
          <button aria-label="Down" onClick={() => steer(DOWN)} type="button">
            ▼
          </button>
          <button aria-label="Right" onClick={() => steer(RIGHT)} type="button">
            ▶
          </button>
        </div>

        <div className="stx-worm__foot">
          <span className="stx-worm__keys">Arrows move. Space pauses.</span>
          <button className="stx-worm__close" onClick={close} type="button">
            Close
          </button>
        </div>

        <p aria-live="polite" className="stx-sr">
          {announcement}
        </p>
      </div>
    </>
  );
}
