/**
 * Editing the focused field from the HAIZ keyboard: insert, delete, move the caret. Every change
 * goes through the browser's own editing (setRangeText) and is announced with an input event, so
 * React's controlled fields see it exactly like typing.
 */
export type Field = HTMLInputElement | HTMLTextAreaElement;

const TEXTUAL = new Set(["text", "search", "url", "tel", "password", ""]);
export function isEditable(el: EventTarget | null): el is Field {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false;
  if (el.readOnly || el.disabled) return false;
  if (el.closest("[data-system-keyboard]")) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  return TEXTUAL.has(el.type) || el.type === "email" || el.type === "number";
}
const hasSelection = (el: Field) => el instanceof HTMLTextAreaElement || TEXTUAL.has(el.type);

function setValue(el: Field, v: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, v);
}
function announce(el: Field, data: string | null, inputType: string) {
  el.dispatchEvent(new InputEvent("input", { bubbles: true, data, inputType }));
}

export function insert(el: Field, text: string) {
  if (el.maxLength > 0 && el.value.length + text.length > el.maxLength) text = text.slice(0, Math.max(0, el.maxLength - el.value.length));
  if (!text) return;
  if (hasSelection(el)) {
    const s = el.selectionStart ?? el.value.length, e = el.selectionEnd ?? s;
    el.setRangeText(text, s, e, "end");
  } else setValue(el, el.value + text);
  announce(el, text, "insertText");
}

/** delete backwards: one character (a whole surrogate pair or emoji), or a word */
export function backspace(el: Field, word = false) {
  if (hasSelection(el)) {
    let s = el.selectionStart ?? 0; const e = el.selectionEnd ?? s;
    if (s === e) {
      if (s === 0) return;
      const before = el.value.slice(0, s);
      if (word) { const m = before.match(/(\s*[一-鿿]|\s*[\w]+|\s*[^\s\w]|\s+)$/u); s -= m ? m[0].length : 1; }
      else { const chars = [...before]; s -= chars[chars.length - 1]?.length ?? 1; }
    }
    el.setRangeText("", Math.max(0, s), e, "end");
  } else setValue(el, [...el.value].slice(0, -1).join(""));
  announce(el, null, word ? "deleteWordBackward" : "deleteContentBackward");
}

export function move(el: Field, by: number) {
  if (!hasSelection(el)) return;
  const v = el.value, p = el.selectionEnd ?? v.length;
  let q = p;
  // step over whole code points
  if (by < 0) for (let i = 0; i < -by && q > 0; i++) q -= (q >= 2 && /[\uDC00-\uDFFF]/.test(v[q - 1])) ? 2 : 1;
  else for (let i = 0; i < by && q < v.length; i++) q += (/[\uD800-\uDBFF]/.test(v[q])) ? 2 : 1;
  el.setSelectionRange(q, q);
}
export function moveTo(el: Field, where: "start" | "end") { if (hasSelection(el)) { const q = where === "start" ? 0 : el.value.length; el.setSelectionRange(q, q); } }
export function selectAll(el: Field) { el.select(); }

export function enter(el: Field) {
  if (el instanceof HTMLTextAreaElement) { insert(el, "\n"); return; }
  const ev = new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true, cancelable: true } as any);
  const go = el.dispatchEvent(ev);
  el.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));
  if (go && el.form) { try { el.form.requestSubmit(); } catch { /* no submitter */ } }
}
