import { Fragment } from "react";
import { APP_VERSION } from "../version";
import type { UpdatePhase } from "../state/updater";
import { IconClose } from "./Icons";

/**
 * The startup "a new version is here" dialog (v2.45.0, redesigned v2.46.0).
 *
 * Shown only for updates found by the AUTOMATIC startup check — manual checks
 * report inline in Settings → Updates. Renders three of the updater phases:
 * available (pitch + notes + install), downloading (progress bar), ready
 * (restart). The other phases never reach this component.
 */
export interface UpdatePromptProps {
  update: UpdatePhase;
  onInstall: () => void;
  onRelaunch: () => void;
  onDismiss: () => void;
}

/**
 * Release notes arrive as markdown-ish text (the GitHub release body or the
 * short latest.json blurb). Full markdown is overkill and a renderer
 * dependency is unjustifiable here — this renders the three constructs the
 * project's own release notes actually use (## headings, - bullets, **bold**)
 * and leaves everything else as plain text. Pure text nodes, no HTML
 * injection surface.
 */
function renderNotes(notes: string) {
  const bold = (line: string, key: number) => {
    // Odd indices sat between ** pairs — render them strong. An unmatched
    // trailing ** just bolds to end of line, harmless for release notes.
    const parts = line.split("**");
    return (
      <Fragment key={key}>
        {parts.map((p, i) =>
          i % 2 === 1 ? <strong key={i}>{p}</strong> : <Fragment key={i}>{p}</Fragment>,
        )}
      </Fragment>
    );
  };
  const blocks: React.ReactNode[] = [];
  let bullets: React.ReactNode[] = [];
  const flushBullets = () => {
    if (bullets.length) {
      blocks.push(<ul key={`ul${blocks.length}`}>{bullets}</ul>);
      bullets = [];
    }
  };
  notes.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) {
      flushBullets();
      return;
    }
    if (/^#{1,4}\s/.test(line)) {
      flushBullets();
      blocks.push(<h4 key={i}>{line.replace(/^#{1,4}\s+/, "")}</h4>);
    } else if (/^[-*]\s/.test(line)) {
      bullets.push(<li key={i}>{bold(line.replace(/^[-*]\s+/, ""), i)}</li>);
    } else {
      flushBullets();
      blocks.push(<p key={i}>{bold(line, i)}</p>);
    }
  });
  flushBullets();
  return blocks;
}

export function UpdatePrompt({ update, onInstall, onRelaunch, onDismiss }: UpdatePromptProps) {
  if (update.state !== "available" && update.state !== "downloading" && update.state !== "ready")
    return null;

  const version = update.state === "available" || update.state === "ready" ? update.version : null;
  const pct =
    update.state === "downloading" && update.total
      ? Math.min(100, Math.round((update.received / update.total) * 100))
      : null;

  return (
    <div className="modal-backdrop" onClick={onDismiss}>
      <div
        className="modal update-prompt"
        role="dialog"
        aria-modal="true"
        aria-label={update.state === "ready" ? "Update installed" : "Update available"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="update-hero">
          <button
            className="icon-btn subtle update-hero-close"
            aria-label="Close"
            onClick={onDismiss}
          >
            <IconClose size={16} />
          </button>
          <div className="update-hero-icon" aria-hidden>
            {update.state === "ready" ? (
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : (
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3v12" />
                <path d="M6 11l6 6 6-6" />
                <path d="M4 21h16" />
              </svg>
            )}
          </div>
          <div className="update-hero-text">
            <span className="update-hero-title">
              {update.state === "ready"
                ? "Ready — restart to finish"
                : update.state === "downloading"
                  ? "Downloading update"
                  : "A new Beatform is here"}
            </span>
            <span className="update-hero-versions">
              <span className="update-ver old">v{APP_VERSION}</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M5 12h14" />
                <path d="M13 6l6 6-6 6" />
              </svg>
              <span className="update-ver new">{version ? `v${version}` : "…"}</span>
            </span>
          </div>
        </div>

        {update.state === "available" && (
          <>
            {update.notes && <div className="update-notes">{renderNotes(update.notes)}</div>}
            <p className="update-fineprint">
              Downloads in the background from GitHub Releases and is verified against Beatform's
              signing key before it installs. Applies on restart.
            </p>
            <div className="update-actions">
              <button className="update-cta" onClick={onInstall}>
                Install now
              </button>
              <button className="ghost-btn" onClick={onDismiss}>
                Later
              </button>
            </div>
          </>
        )}

        {update.state === "downloading" && (
          <div className="update-progress-wrap">
            <div
              className="update-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              {...(pct !== null ? { "aria-valuenow": pct } : {})}
            >
              <div
                className={`update-progress-fill ${pct === null ? "indeterminate" : ""}`}
                style={pct !== null ? { width: `${pct}%` } : undefined}
              />
            </div>
            <span className="update-progress-label">
              {pct !== null
                ? `${pct}% · ${(update.received / 1e6).toFixed(1)} of ${(update.total! / 1e6).toFixed(1)} MB`
                : `${(update.received / 1e6).toFixed(1)} MB`}
            </span>
          </div>
        )}

        {update.state === "ready" && (
          <>
            <p className="update-fineprint">
              Version {version} is installed and takes over on the next launch — restart whenever
              suits you.
            </p>
            <div className="update-actions">
              <button className="update-cta" onClick={onRelaunch}>
                Restart now
              </button>
              <button className="ghost-btn" onClick={onDismiss}>
                Restart later
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
