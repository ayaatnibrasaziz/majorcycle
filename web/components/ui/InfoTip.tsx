'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

interface InfoTipProps {
  /** Bold heading shown at the top of the bubble — usually the term being explained. */
  title?: string;
  /** Plain-English explanation. */
  children: React.ReactNode;
  /** Accessible label for the trigger. Defaults to "What is {title}?" / "More information". */
  label?: string;
  /** Icon size in px (default 13). */
  size?: number;
  /** Extra classes on the trigger button. */
  className?: string;
}

interface Coords {
  top: number;
  left: number;
  placement: 'top' | 'bottom';
}

const POP_MAX_WIDTH = 264;
const HIDE_DELAY = 100;

/**
 * Beginner-help explainer (S5). A small ⓘ affordance that reveals a plain-English
 * explanation on hover (desktop), tap (mobile/touch), and keyboard focus.
 *
 * Why a portal: the bubble is rendered to `document.body` with `position: fixed`
 * so it is never clipped by an ancestor's `overflow: hidden` (chart wrappers,
 * scrollable tables) and always sits above the sticky header/sub-nav.
 */
export function InfoTip({ title, children, label, size = 13, className }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tipId = useId();

  const position = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    const margin = 8;
    const popW = Math.min(POP_MAX_WIDTH, window.innerWidth - margin * 2);
    const half = popW / 2;
    // Centre the (translateX(-50%)) bubble on the trigger, clamped to the viewport.
    let left = r.left + r.width / 2;
    left = Math.min(Math.max(left, margin + half), window.innerWidth - margin - half);
    // Flip above the trigger when there isn't room below.
    const placement: 'top' | 'bottom' =
      r.bottom + 160 > window.innerHeight && r.top > 160 ? 'top' : 'bottom';
    const top = placement === 'bottom' ? r.bottom + 8 : r.top - 8;
    setCoords({ top, left, placement });
  }, []);

  const clearHide = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const show = useCallback(() => {
    clearHide();
    position();
    setOpen(true);
  }, [clearHide, position]);

  // Delayed hide so the pointer can travel from the icon onto the bubble.
  const hide = useCallback(() => {
    clearHide();
    hideTimer.current = setTimeout(() => setOpen(false), HIDE_DELAY);
  }, [clearHide]);

  const hideNow = useCallback(() => {
    clearHide();
    setOpen(false);
  }, [clearHide]);

  const toggle = useCallback(() => {
    if (open) hideNow();
    else show();
  }, [open, hideNow, show]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') hideNow();
    }
    function onDocPointer(e: Event) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || popRef.current?.contains(t)) return;
      hideNow();
    }
    // Any scroll/resize invalidates the measured position — just close.
    window.addEventListener('scroll', hideNow, true);
    window.addEventListener('resize', hideNow);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDocPointer);
    return () => {
      window.removeEventListener('scroll', hideNow, true);
      window.removeEventListener('resize', hideNow);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDocPointer);
    };
  }, [open, hideNow]);

  useEffect(() => () => clearHide(), [clearHide]);

  const ariaLabel = label ?? (title ? `What is ${title}?` : 'More information');

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={`info-tip-trigger${className ? ` ${className}` : ''}`}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle();
        }}
      >
        <Info width={size} height={size} strokeWidth={2} aria-hidden="true" />
      </button>
      {open && coords && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={popRef}
              id={tipId}
              role="tooltip"
              className="info-tip-pop"
              data-placement={coords.placement}
              style={{
                top: coords.top,
                left: coords.left,
                maxWidth: POP_MAX_WIDTH,
                transform: `translate(-50%, ${coords.placement === 'top' ? '-100%' : '0'})`,
              }}
              onMouseEnter={show}
              onMouseLeave={hide}
            >
              {title ? <div className="info-tip-pop-title">{title}</div> : null}
              <div className="info-tip-pop-body">{children}</div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
