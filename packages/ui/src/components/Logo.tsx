import type { CSSProperties } from "react";
import type { SkyPair } from "../agent/engine.js";
import { cx } from "../cx";

/**
 * The squadchat mark: speech bubble with two human dots and one agent square.
 * `sky`: a given workspace's pair (`workspaceSky`) colors the agent square in place of the active accent.
 */
export function LogoMark({
  size,
  className,
  label,
  sky,
}: {
  size?: number;
  className?: string;
  label?: string;
  sky?: SkyPair;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cx("ac-logo__mark", className)}
      style={size ? { width: size, height: size } : undefined}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path
        className="ac-logo__bubble"
        d="M9 4h14a7 7 0 0 1 7 7v6a7 7 0 0 1-7 7H12.4l-5.6 4.4a.9.9 0 0 1-1.46-.7v-4.5A7 7 0 0 1 2 17v-6a7 7 0 0 1 7-7Z"
      />
      <circle className="ac-logo__person" cx="9.6" cy="14" r="2.4" />
      <circle className="ac-logo__person" cx="16" cy="14" r="2.4" />
      <rect
        className="ac-logo__agent"
        x="20"
        y="11.6"
        width="4.8"
        height="4.8"
        rx="1.2"
        style={sky ? { fill: sky[1] } : undefined}
      />
    </svg>
  );
}

export interface LogoProps {
  /** Kept for caller compatibility; squadchat uses one unified wordmark across surfaces. */
  variant?: "main" | "expanded";
  /** One-color version. */
  mono?: boolean;
  /** Font size in px; the mark scales with it. Below 18px use `LogoMark` alone. */
  size?: number;
  className?: string;
  style?: CSSProperties;
}

/** "squadchat" logo: speech-bubble mark + wordmark in Instrument Serif (italic "chat"). Accessible name "squadchat". */
export function Logo({ variant: _variant = "main", mono, size = 24, className, style }: LogoProps) {
  return (
    <span
      className={cx("ac-logo", mono && "ac-logo--mono", className)}
      style={{ fontSize: size, ...style }}
      role="img"
      aria-label="squadchat"
    >
      <LogoMark />
      <span className="ac-logo__word" aria-hidden="true">
        <span>squad</span>
        <em className="ac-logo__chat">chat</em>
      </span>
    </span>
  );
}
