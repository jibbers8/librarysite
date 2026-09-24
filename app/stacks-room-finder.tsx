"use client";

import { useEffect, useId, useRef, useState } from "react";

import { CAPACITY_OPTIONS, TIME_OPTIONS, useLibCalSearch } from "@/app/libcal-search-tool";

export function StacksRoomFinder({ label = "Find a room" }: { label?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { date, setDate, start, setStart, end, setEnd, capacity, setCapacity, validRange, openSearch } =
    useLibCalSearch();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    function handlePointer(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKey);
    document.addEventListener("pointerdown", handlePointer);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("pointerdown", handlePointer);
    };
  }, [isOpen]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    openSearch();
  }

  return (
    <div className="stx-finder" ref={rootRef}>
      <button
        aria-controls={panelId}
        aria-expanded={isOpen}
        className="stx-button stx-button--solid"
        onClick={() => setIsOpen((prev) => !prev)}
        ref={triggerRef}
        type="button"
      >
        <span className="stx-foil">{label}</span>
      </button>

      {isOpen && (
        <section aria-label="Group room search" className="stx-card" id={panelId}>
          <h2 className="stx-card__title">Find a group study room</h2>
          <p className="stx-card__note">Pick a time and we&rsquo;ll open the matching LibCal search in a new tab.</p>

          <form className="stx-card__form" onSubmit={handleSubmit}>
            <label className="stx-field stx-field--wide">
              <span>Date</span>
              <input onChange={(event) => setDate(event.target.value)} type="date" value={date} />
            </label>

            <label className="stx-field stx-field--wide">
              <span>Group size</span>
              <select onChange={(event) => setCapacity(event.target.value)} value={capacity}>
                {CAPACITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="stx-field">
              <span>From</span>
              <select onChange={(event) => setStart(event.target.value)} value={start}>
                {TIME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="stx-field">
              <span>Until</span>
              <select
                aria-invalid={!validRange}
                onChange={(event) => setEnd(event.target.value)}
                value={end}
              >
                {TIME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {!validRange && (
              <p className="stx-card__error" role="alert">
                Pick an end time after the start time.
              </p>
            )}

            <div className="stx-card__actions">
              <button className="stx-button stx-button--solid" disabled={!validRange} type="submit">
                Search LibCal
              </button>
              <button className="stx-button stx-button--quiet" onClick={() => setIsOpen(false)} type="button">
                Close
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
