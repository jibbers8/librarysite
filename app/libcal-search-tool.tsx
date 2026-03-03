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
    window.location.href = searchUrl;
  }

  return (
    <section className="mb-6 rounded-lg border p-4">
      <h2 className="text-lg font-semibold">Find Group Study Rooms</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Opens the UA Libraries LibCal search with your selected date/time and
        capacity.
      </p>
      <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
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
          <p className="md:col-span-2 text-sm text-red-700">
            End time must be later than start time.
          </p>
        )}

        <div className="md:col-span-2">
          <button
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
            disabled={!validRange}
            type="submit"
          >
            Open Room Search
          </button>
        </div>
      </form>
    </section>
  );
}
