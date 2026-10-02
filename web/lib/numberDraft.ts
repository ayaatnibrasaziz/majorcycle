'use client';

import { useState, type ChangeEvent } from 'react';

/**
 * How a typed number box behaves, for the Custom horizon on BOTH the Run Analysis and
 * the Browse pages (owner, 2026-10-03: "ensure both pages are consistent").
 *
 * ⚠️ ONE copy, used by both. The Run page was fixed on 2026-10-02 and Browse kept the
 * old behaviour, because each page had written its own input — the drift 11c-iv
 * describes, inside one feature.
 *
 * - The box keeps what was typed. Bound straight to a number it cannot hold a half-typed
 *   value: clearing it wrote 0, and "-" (which a number input reports as "") wrote 0
 *   too, so "-8" came out as "08".
 * - A value with a leading zero ("05", "-05", "0252") is refused with its own message
 *   rather than quietly read as 5 — the box would otherwise go on showing "05" for a
 *   setting that is really 5.
 * - The parent receives NaN while the box does not hold a usable number, so its own
 *   checks (`boundError`, `validateHorizon`, Browse's `customValid`) treat it as invalid.
 */

/** The message for a typed value that is not yet a usable number, or null. */
export function draftError(text: string): string | null {
  const t = text.trim();
  if (t === '' || t === '-' || t === '.' || t === '-.') return 'Enter a number.';
  if (/^-?0\d/.test(t)) return 'Remove the leading 0.';
  return Number.isFinite(Number(t)) ? null : 'Enter a number.';
}

/** The number a box holds, or NaN while it holds nothing usable. */
export function parseDraft(text: string): number {
  return draftError(text) === null ? Number(text.trim()) : NaN;
}

/**
 * The text a number box shows, kept in step with the parent's value: when the parent
 * changes it (a preset click), the box takes the new value; while the reader types,
 * the box keeps their text.
 */
export function useNumberDraft(value: number, onChange: (n: number) => void) {
  const [text, setText] = useState(() => (Number.isFinite(value) ? String(value) : ''));
  const [lastValue, setLastValue] = useState(value);
  if (!Object.is(value, lastValue)) {
    setLastValue(value);
    if (!Object.is(value, parseDraft(text))) setText(Number.isFinite(value) ? String(value) : '');
  }

  const onInput = (e: ChangeEvent<HTMLInputElement>) => {
    // A number input reports "" for an unfinished entry such as "-" or "1e";
    // `badInput` says the box is not really empty, so keep waiting rather than clear it.
    const raw = e.target.value;
    const incomplete = raw === '' && e.target.validity.badInput;
    setText(incomplete ? '-' : raw);
    onChange(incomplete ? NaN : parseDraft(raw));
  };

  return {
    /** What the input's `value` should be ("-" is held by the browser, not by us). */
    inputValue: text === '-' ? '' : text,
    onInput,
    /**
     * "Remove the leading 0." when that is the problem, which outranks the parent's
     * own message; an empty or half-typed box is left to the parent ("Enter a number." /
     * "Enter a whole number."), which already knows which of the two applies.
     */
    typingError: /^-?0\d/.test(text.trim()) ? 'Remove the leading 0.' : null,
  };
}
