// src/components/Timeline.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";

/**
 Props:
  - simNowRef: ref(Date) (required)
  - isPlaying: boolean
  - setIsPlaying: fn(bool)
  - speedMultiplier: number (1,2,4,8)
  - setSpeedMultiplier: fn(number)
  - setSimNowAbsolute: fn(ms)
  - timelineDates: array of Date strings (ISO) length 7 (optional)
*/

// move constant outside component so identity is stable
const DEFAULT_DATES = [
  "2025-09-01",
  "2025-09-02",
  "2025-09-03",
  "2025-09-04",
  "2025-09-05",
  "2025-09-06",
  "2025-09-07",
];

export default function Timeline({
  simNowRef,
  isPlaying,
  setIsPlaying,
  speedMultiplier,
  setSpeedMultiplier,
  setSimNowAbsolute,
  timelineDates = null,
}) {
  const DAY_MS = 24 * 3600 * 1000;
  const STEP_MS = 1000; // slider step set to 1 second for good resolution
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [localOffsetMs, setLocalOffsetMs] = useState(0); // offset from midnight of selected day (ms)
  const scrubbingRef = useRef(false);
  const wasPlayingBeforeScrub = useRef(false);

  // memoize days so identity is stable across renders unless timelineDates changes
  const days = useMemo(() => {
    if (Array.isArray(timelineDates) && timelineDates.length > 0) {
      return timelineDates;
    }
    return DEFAULT_DATES;
  }, [timelineDates]);

  // Format time with seconds: hh:mm:ss
  const fmtTimeWithSeconds = (ms) => {
    const d = new Date(ms);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  };

  // Single effect: update displayed slider/time from simNowRef periodically while playing
  useEffect(() => {
    if (!simNowRef || !simNowRef.current) return;
    let interval = null;

    const sync = () => {
      if (!simNowRef || !simNowRef.current) return;
      if (scrubbingRef.current) return; // don't override while user scrubs
      const simMs = simNowRef.current.getTime();

      // find which day index contains simMs
      const idx = days.findIndex((d) => {
        const base = new Date(d + "T00:00:00").getTime();
        return simMs >= base && simMs < base + DAY_MS;
      });
      const i = idx >= 0 ? idx : 0;
      const baseMs = new Date(days[i] + "T00:00:00").getTime();
      const offset = Math.max(0, Math.min(DAY_MS - 1, simMs - baseMs));

      // only update if changed
      setSelectedDayIndex((prev) => (prev === i ? prev : i));
      setLocalOffsetMs((prev) => (prev === offset ? prev : offset));
    };

    // run once immediately
    sync();

    interval = setInterval(sync, isPlaying ? 250 : 1000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [simNowRef, isPlaying, days]); // days is memoized so identity is stable

  // Scrubbing handlers
  const handlePointerDown = (e) => {
    scrubbingRef.current = true;
    wasPlayingBeforeScrub.current = isPlaying;
    setIsPlaying(false); // pause playback while scrubbing
    const v = Number(e.currentTarget.value);
    setLocalOffsetMs(v);
  };

  const handlePointerMove = (e) => {
    if (!scrubbingRef.current) return;
    const v = Number(e.currentTarget.value);
    setLocalOffsetMs(v);
    const baseMs = new Date(days[selectedDayIndex] + "T00:00:00").getTime();
    setSimNowAbsolute(baseMs + v);
  };

  const handlePointerUp = () => {
    scrubbingRef.current = false;
    // restore playing if it was playing before scrub
    if (wasPlayingBeforeScrub.current) setIsPlaying(true);
  };

  const handleSliderChange = (e) => {
    const v = Number(e.currentTarget.value);
    setLocalOffsetMs(v);
    const baseMs = new Date(days[selectedDayIndex] + "T00:00:00").getTime();
    setSimNowAbsolute(baseMs + v);
  };

  // IMPORTANT: when user clicks a day button we reset to 00:00 and set sim to midnight of that day
  const handleDayClick = (idx) => {
    setSelectedDayIndex(idx);
    const baseMs = new Date(days[idx] + "T00:00:00").getTime();
    setLocalOffsetMs(0); // reset timeline to 00:00:00
    setSimNowAbsolute(baseMs);
  };

  // Play/pause icon svgs
  const PlayIcon = ({ size = 18 }) => (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
  const PauseIcon = ({ size = 18 }) => (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );

  // Styles
  const containerStyle = {
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    bottom: 18,
    width: "84%",
    maxWidth: 1100,
    zIndex: 2000,
    pointerEvents: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    fontFamily:
      "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  };

  const controlsRow = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  };

  const playBtnStyle = {
    width: 56,
    height: 56,
    borderRadius: 28,
    background: "rgba(0,0,0,0.6)",
    border: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    cursor: "pointer",
    boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
  };

  const speedBtnStyle = (active) => ({
    padding: "8px 12px",
    borderRadius: 8,
    border: active
      ? "1px solid rgba(0,170,255,0.9)"
      : "1px solid rgba(255,255,255,0.06)",
    background: active ? "rgba(0,170,255,0.12)" : "rgba(0,0,0,0.55)",
    color: "#fff",
    cursor: "pointer",
    minWidth: 44,
    textAlign: "center",
  });

  const sliderRow = {
    display: "flex",
    alignItems: "center",
    gap: 12,
  };

  const sliderStyle = {
    WebkitAppearance: "none",
    appearance: "none",
    height: 8,
    borderRadius: 10,
    background:
      "linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.04))",
    width: "100%",
    outline: "none",
  };

  return (
    <div style={containerStyle}>
      {/* Top controls: Play/Pause centered, speed multipliers beside it */}
      <div style={controlsRow}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div
            role="button"
            aria-label={isPlaying ? "Pause" : "Play"}
            title={isPlaying ? "Pause" : "Play"}
            onClick={() => setIsPlaying(!isPlaying)}
            style={playBtnStyle}
          >
            {isPlaying ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {[1, 2, 4, 8].map((s) => (
              <button
                key={s}
                onClick={() => setSpeedMultiplier(s)}
                style={speedBtnStyle(speedMultiplier === s)}
                title={`${s}x`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Slider row */}
      <div style={sliderRow}>
        <div style={{ color: "#fff", minWidth: 72, textAlign: "left" }}>
          {fmtTimeWithSeconds(
            new Date(days[selectedDayIndex] + "T00:00:00").getTime() +
              localOffsetMs
          )}
        </div>

        <input
          type="range"
          min={0}
          max={DAY_MS - STEP_MS}
          step={STEP_MS}
          value={localOffsetMs}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onChange={handleSliderChange}
          onInput={handleSliderChange}
          style={sliderStyle}
        />

        <div style={{ color: "#fff", minWidth: 72, textAlign: "right" }}>
          23:59:59
        </div>
      </div>

      {/* Days */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
        {days.map((d, i) => {
          const active = i === selectedDayIndex;
          return (
            <button
              key={d}
              onClick={() => handleDayClick(i)}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: active
                  ? "1px solid rgba(0,170,255,0.9)"
                  : "1px solid rgba(255,255,255,0.04)",
                background: active
                  ? "rgba(0,170,255,0.12)"
                  : "rgba(0,0,0,0.55)",
                color: "#fff",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {d.replace("2025-", "")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
