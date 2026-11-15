'use client';

import { useEffect, useRef, useState } from 'react';

import { FILM_LINES } from '@/lib/landingFilm';

/**
 * The landing film: a 35-second cartoon that loops in the hero, silent until asked.
 *
 * ── Why the words are NOT in the video ───────────────────────────────────────
 *
 * The film was drawn with one short line per scene. Burnt into the picture, those
 * lines would be 15px tall on a phone and invisible to a search engine or a screen
 * reader. So the video is exported without them and the nine lines are real text:
 * laid over the picture on a wide screen (sized in container units, so they scale
 * with it exactly as the drawn ones did) and set underneath it on a narrow one.
 *
 * ⚠️ `FILM_LINES[].at` (lib/landingFilm.ts) is a copy of the scene start times in the film's source
 * (`reference/landing-concept/film.js`, `SCENES`). If the film is re-cut and
 * re-exported, these must move with it — `e2e/landing.spec.ts` checks the total
 * against the video's own duration so a re-export cannot drift silently.
 *
 * ── How it starts ────────────────────────────────────────────────────────────
 *
 * There is no `autoplay` attribute, on purpose. An attribute plays for everyone,
 * including a reader who has asked their device for less motion, before any code
 * can ask. So the server renders a still poster with the first line, and this
 * effect starts the film only when the reader has not asked for reduced motion or
 * data saving. Without JavaScript the page shows the poster and the first line,
 * which is a complete, static hero.
 *
 * A reader who asked for reduced motion gets the film's LAST frame (the shortlist)
 * with its line, and a play button if they want to watch after all.
 *
 * ── The voice ────────────────────────────────────────────────────────────────
 *
 * The video files carry a narration track: a short marketing voice-over written
 * for the film (owner-approved, November 2026), read by Kokoro's "Heart" voice
 * (open-source, Apache-2.0; the owner's choice, 15 Nov 2026). It says more than the
 * on-screen lines do; the lines stay as they are. It is OFF until the reader presses
 * the sound button, which is also the only way a browser will let a film start by
 * itself with sound. The track lives inside the video file rather than beside it, so
 * the voice cannot drift from the picture and loops with it.
 *
 * No "AI voice" label on the button or the film (owner, 15 Nov 2026: "it doesn't look
 * professional"). The same track carries quiet sound effects under the voice, so this one
 * button turns both on (docs/design-system.md, the landing film).
 */
const LAST = FILM_LINES.length - 1;

function lineAt(seconds: number): number {
  let i = LAST;
  while (i > 0 && seconds < (FILM_LINES[i]?.at ?? 0)) i--;
  return i;
}

export function LandingFilm() {
  const video = useRef<HTMLVideoElement>(null);
  const figure = useRef<HTMLElement>(null);
  // What the reader asked for with the button. Scrolling the film out of view
  // pauses it too, and must not be mistaken for that.
  const wantsPlay = useRef(false);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [sound, setSound] = useState(false);

  useEffect(() => {
    const v = video.current;
    const fig = figure.current;
    if (!v || !fig) return;

    // React does not reliably write `muted` as an attribute, and a browser only
    // allows a film to start by itself when it is muted.
    v.muted = true;

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saver =
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData ===
      true;

    // Two clocks. Animation frames keep the line within a frame of the cut while
    // the film is on screen; `timeupdate` is the fallback for a tab the browser has
    // stopped painting, where animation frames never arrive.
    let frame = 0;
    const sync = () => setActive(lineAt(v.currentTime));
    const tick = () => {
      sync();
      frame = window.requestAnimationFrame(tick);
    };
    const onPlay = () => {
      setPlaying(true);
      setStarted(true);
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(tick);
    };
    const onPause = () => {
      setPlaying(false);
      window.cancelAnimationFrame(frame);
    };
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('timeupdate', sync);
    v.addEventListener('seeked', sync);
    // The button reflects the element, not the other way round, so a browser that
    // mutes the film by itself cannot leave the button claiming the sound is on.
    const onVolume = () => setSound(!v.muted);
    v.addEventListener('volumechange', onVolume);

    // Some browsers refuse to START a film that has sound unless the reader has
    // just pressed something. Coming back on screen is not a press, so the film
    // resumes silent rather than not at all.
    const resume = () => {
      void v.play().catch(() => {
        v.muted = true;
        return v.play().catch(() => undefined);
      });
    };

    // Off screen, a looping film is battery spent on nobody.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!wantsPlay.current) continue;
          if (e.isIntersecting) resume();
          else v.pause();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(fig);

    // A tab left in the background keeps playing sound, which would be a voice
    // talking to nobody. The film stops with the tab and comes back with it.
    const onVisibility = () => {
      if (!wantsPlay.current) return;
      if (document.hidden) v.pause();
      else resume();
    };
    document.addEventListener('visibilitychange', onVisibility);

    if (!still && !saver) {
      wantsPlay.current = true;
      void v.play().catch(() => {
        // A browser that refuses leaves the poster and the play button, which is
        // the same state a reduced-motion reader starts in.
        wantsPlay.current = false;
      });
    }

    return () => {
      window.cancelAnimationFrame(frame);
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      v.removeEventListener('volumechange', onVolume);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('timeupdate', sync);
      v.removeEventListener('seeked', sync);
    };
  }, []);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      wantsPlay.current = true;
      void v.play().catch(() => undefined);
    } else {
      wantsPlay.current = false;
      v.pause();
    }
  };

  const toggleSound = () => {
    const v = video.current;
    if (!v) return;
    if (v.muted) {
      v.muted = false;
      // Asking for the voice is asking to hear the film, so a paused film starts.
      if (v.paused) {
        wantsPlay.current = true;
        void v.play().catch(() => undefined);
      }
    } else {
      v.muted = true;
    }
  };

  return (
    <figure
      ref={figure}
      className="film"
      data-film
      data-started={started ? '' : undefined}
      aria-label="A short film showing how MajorCycle works"
    >
      {/* The stage holds the picture AND its lines, so that on a wide screen the
          lines are inside the film's own navy box in the document as well as on
          screen. */}
      <div className="film-stage">
      <div className="film-frame">
        <video
          ref={video}
          className="film-video"
          muted
          loop
          playsInline
          preload="metadata"
          poster="/film/poster.webp"
          width={1920}
          height={1080}
          // The picture is described by the nine lines beside it; the element
          // itself has nothing more to say to a screen reader.
          aria-hidden="true"
          tabIndex={-1}
        >
          {/* Sharpest first for screens that can show it; every browser takes the
              first source it can play, so the order is also the fallback order. */}
          <source src="/film/majorcycle-1080.webm" type="video/webm" media="(min-width: 700px)" />
          <source src="/film/majorcycle-1080.mp4" type="video/mp4" media="(min-width: 700px)" />
          <source src="/film/majorcycle-720.webm" type="video/webm" />
          <source src="/film/majorcycle-720.mp4" type="video/mp4" />
        </video>
        {/* The reduced-motion still: the film's last frame. A background, so a
            browser only fetches it when the rule that shows it applies. */}
        <div className="film-still" aria-hidden="true" />
        <button
          type="button"
          className="film-toggle"
          onClick={toggle}
          aria-label={playing ? 'Pause the film' : 'Play the film'}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            {playing ? (
              <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
            ) : (
              <path d="M8 5l11 7-11 7z" fill="currentColor" />
            )}
          </svg>
        </button>
        <button
          type="button"
          className="film-toggle film-sound"
          onClick={toggleSound}
          aria-pressed={sound}
          aria-label="Voice-over"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" fill="currentColor" />
            {sound ? (
              <path
                d="M15 9.2a4 4 0 0 1 0 5.6M17.6 6.8a7.4 7.4 0 0 1 0 10.4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M15.5 9.5l5 5M20.5 9.5l-5 5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      </div>

      {/* All nine lines are always in the document, in order. Only the current one
          is shown; the rest stay readable to a screen reader and a crawler. */}
      <ol className="film-lines">
        {FILM_LINES.map((l, i) => (
          <li
            key={l.at}
            className="film-line"
            data-on={i === active ? '' : undefined}
            data-in-picture={l.inPicture ? '' : undefined}
          >
            <span className="film-line-title">
              {l.n ? <span className="film-line-n">{l.n}</span> : null}
              {l.title}
            </span>
            {l.sub ? <span className="film-line-sub">{l.sub}</span> : null}
          </li>
        ))}
      </ol>
      </div>
    </figure>
  );
}
