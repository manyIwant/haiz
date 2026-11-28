/**
 * 点阵输入 · dot form (HAIZ Native 001, after the Whitespace "dot form" study, reimplemented).
 *
 * A text field whose underline is a row of dots: one lights for every character, the next one
 * breathes where the caret is, and on an error the row shakes and cools. Everything is CSS on
 * two gradient layers whose lit width is a custom property, so typing costs one style write.
 */
import { forwardRef, useId, type InputHTMLAttributes } from "react";
import "./dotfield.css";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  label: string;
  value: string;
  onChange(v: string): void;
  error?: boolean;
  hint?: string;
  dots?: number;
};

export const DotField = forwardRef<HTMLInputElement, Props>(function DotField({ label, value, onChange, error, hint, dots = 24, className, ...rest }, ref) {
  const id = useId();
  const n = Math.min(dots, [...value].length);
  return (
    <label className={"dotf" + (error ? " is-error" : "") + (value ? " is-filled" : "") + (className ? " " + className : "")} htmlFor={id}
      style={{ ["--n" as any]: n, ["--dots" as any]: dots }}>
      <span className="dotf-l">{label}</span>
      <input id={id} ref={ref} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" spellCheck={false} {...rest} />
      <span className="dotf-track" aria-hidden="true"><i className="dotf-lit" /><i className="dotf-caret" /></span>
      {hint && <span className="dotf-h">{hint}</span>}
    </label>
  );
});
