"use client";

import { useMemo, useState } from "react";

const LIBCAL_BASE_URL = "https://libcal.library.arizona.edu/r/search";

const CAPACITY_OPTIONS = [
  { label: "All spaces", value: "0" },
  { label: "1-2 people", value: "1" },
  { label: "3-5 people", value: "2" },
  { label: "6-12 people", value: "3" },
];

function getTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function buildTimeOptions() {
  const options: Array<{ label: string; value: string }> = [];
  for (let hour = 7; hour <= 23; hour += 1) {
    for (const minute of [0, 30]) {
      const value = `${pad(hour)}:${pad(minute)}`;
      const ampmHour = ((hour + 11) % 12) + 1;
      const ampm = hour >= 12 ? "PM" : "AM";
      options.push({ label: `${ampmHour}:${pad(minute)} ${ampm}`, value });
    }
  }
  return options;
}

function toMinutes(hhmm: string) {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return hours * 60 + minutes;
}

const TIME_OPTIONS = buildTimeOptions();

export function LibCalSearchTool() {
  const [isOpen, setIsOpen] = useState(false);
  const [date, setDate] = useState(getTodayIso);
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("10:00");
  const [capacity, setCapacity] = useState("0");

  const validRange = useMemo(() => toMinutes(end) > toMinutes(start), [end, start]);

  const searchUrl = useMemo(() => {
    const params = new URLSearchParams({
      m: "t",
      lid: "801",
      gid: "1389",
      capacity,
      zone: "0",
      date,
      "date-end": date,
      start,
      end,
    });
    return `${LIBCAL_BASE_URL}?${params.toString()}`;
  }, [capacity, date, end, start]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validRange) {
      return;
    }
    window.open(searchUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="relative">
      <button
        className="rounded-md border px-3 py-2 text-sm font-medium"
        onClick={() => setIsOpen((prev) => !prev)}
        type="button"
      >
        Find Rooms
      </button>

      {isOpen && (
        <section className="absolute right-0 z-20 mt-2 w-[340px] rounded-lg border bg-white p-4 shadow-lg">
          <h2 className="text-base font-semibold">Group Room Search</h2>
          <p className="mt-1 text-xs text-zinc-600">
            Opens LibCal in a new tab.
          </p>

          <form className="mt-3 grid gap-3" onSubmit={handleSubmit}>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Date</span>
              <input
                className="w-full rounded-md border px-2 py-2"
                onChange={(event) => setDate(event.target.value)}
                type="date"
                value={date}
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block font-medium">Capacity</span>
              <select
                className="w-full rounded-md border px-2 py-2"
                onChange={(event) => setCapacity(event.target.value)}
                value={capacity}
              >
                {CAPACITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-1 block font-medium">Start time (24h)</span>
              <select
                className="w-full rounded-md border px-2 py-2"
                onChange={(event) => setStart(event.target.value)}
                value={start}
              >
                {TIME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.value} ({option.label})
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-1 block font-medium">End time (24h)</span>
              <select
                className="w-full rounded-md border px-2 py-2"
                onChange={(event) => setEnd(event.target.value)}
                value={end}
              >
                {TIME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.value} ({option.label})
                  </option>
                ))}
              </select>
            </label>

            {!validRange && (
              <p className="text-sm text-red-700">
                End time must be later than start time.
              </p>
            )}

            <div className="flex items-center gap-2">
              <button
                className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
                disabled={!validRange}
                type="submit"
              >
                Open Search
              </button>
              <button
                className="rounded-md border px-3 py-2 text-sm"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
