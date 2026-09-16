/**
 * How wide a string will actually be, in the font it will actually be drawn in.
 *
 * ⚠️ WRITTEN BECAUSE AN ESTIMATE SHIPPED A CUT LABEL. Two charts decide their own
 * layout from how much room a word needs — the scorecard radar sizes its ring so
 * the pillar names fit beside it, and the Opportunity Map decides whether its
 * zone names fit inside their quadrants. Both first used `chars x fontSize x X`,
 * and the coefficient is a guess that is wrong per string: 0.56 under-predicted
 * Sora and put **"hareholder"** on the scorecard; 0.64 over-predicts anything
 * containing a space. A canvas measures the real advance width, so the decision
 * is made on the thing itself (11i-b: derive geometry from what the browser
 * returns, never from what the rule was meant to say).
 *
 * ⚠️ AND IT MUST BE RE-TAKEN AFTER THE WEBFONT LOADS. Before `document.fonts`
 * settles, the canvas measures the FALLBACK face and returns a number for type
 * nobody will see — the same defect class as a contrast reading taken mid
 * transition (11ao). Callers pair this with `whenFontsReady()`.
 */

let ctx: CanvasRenderingContext2D | null = null;

function context(): CanvasRenderingContext2D | null {
  if (ctx) return ctx;
  if (typeof document === 'undefined') return null;
  ctx = document.createElement('canvas').getContext('2d');
  return ctx;
}

/**
 * The advance width of `text` in px.
 *
 * Returns `null` when there is no canvas to measure with — on the server, or in
 * a browser that refuses one. ⚠️ `null` means "unknown", never "zero": a caller
 * that treated it as a width would size a chart from a measurement it never took
 * (11e — one value must not carry two meanings).
 */
export function textWidth(
  text: string,
  { fontSize, fontWeight = 400, fontFamily = 'Sora, sans-serif' }:
    { fontSize: number; fontWeight?: number; fontFamily?: string },
): number | null {
  const c = context();
  if (!c) return null;
  c.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  return c.measureText(text).width;
}

/** Resolves once the webfonts are in, so a measurement is of the real face. */
export function whenFontsReady(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return Promise.resolve();
  return document.fonts.ready.then(() => undefined);
}
