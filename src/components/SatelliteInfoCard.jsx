// SatelliteInfoCard.jsx
import React, { useMemo } from "react";
import errorDataRaw from "../assets/ErrorData.json";

/**
 Props:
  - sat: satellite object from backend (sat.name used for matching)
  - simNow: Date object (provided by App.jsx simNowState)
*/

function fmtNumber(x, digits = 6) {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  return Number(Number(x)).toFixed(digits);
}

// linear interpolation helper
function lerp(a, b, w) {
  return a * (1 - w) + b * w;
}

const SatelliteInfoCard = ({ sat, simNow = new Date() }) => {
  // parse & normalize errorData once
  const { errorData, mapByName } = useMemo(() => {
    if (!Array.isArray(errorDataRaw)) return { errorData: [], mapByName: {} };

    const parsed = errorDataRaw
      .map((r) => {
        // utctime expected as "YYYY-MM-DD hh:mm:ss" or similar
        const utcStr = String(r.utctime || "").trim();
        const d = utcStr ? new Date(utcStr.replace(" ", "T") + "Z") : null;
        const name = r.name ?? r.satellite ?? r.satname ?? null;
        return {
          ...r,
          __date: d,
          __name: name ? String(name).trim() : null,
        };
      })
      .filter(
        (r) => r.__date instanceof Date && !Number.isNaN(r.__date.getTime())
      )
      .sort((a, b) => a.__date - b.__date);

    const map = {};
    for (const rec of parsed) {
      if (rec.__name) {
        const key = rec.__name.toLowerCase();
        if (!map[key]) map[key] = [];
        map[key].push(rec);
      }
    }

    return { errorData: parsed, mapByName: map };
  }, []);

  // choose dataset for this satellite (if file contains per-sat records)
  const listForSat = useMemo(() => {
    if (!sat || !sat.name) return errorData;
    const key = String(sat.name).trim().toLowerCase();
    return mapByName[key] ?? errorData;
  }, [sat, errorData, mapByName]);

  // numeric ms for reliable deps
  const simNowMs = simNow instanceof Date ? simNow.getTime() : null;

  // compute interpolation between two nearest samples
  const { interpValues, lowerRec, upperRec, lowerIndex, upperIndex, note } =
    useMemo(() => {
      if (!simNowMs || !Array.isArray(listForSat) || listForSat.length === 0) {
        return {
          interpValues: null,
          lowerRec: null,
          upperRec: null,
          lowerIndex: null,
          upperIndex: null,
          note: "no data",
        };
      }

      const n = listForSat.length;

      // if simNow is before first sample or after last sample, pick nearest
      const firstTs = listForSat[0].__date.getTime();
      const lastTs = listForSat[n - 1].__date.getTime();

      if (simNowMs <= firstTs) {
        const rec = listForSat[0];
        return {
          interpValues: {
            x_error: rec.x_error,
            y_error: rec.y_error,
            z_error: rec.z_error,
            satclockerror: rec.satclockerror,
          },
          lowerRec: rec,
          upperRec: null,
          lowerIndex: 0,
          upperIndex: null,
          note: "before range - using first sample",
        };
      }
      if (simNowMs >= lastTs) {
        const rec = listForSat[n - 1];
        return {
          interpValues: {
            x_error: rec.x_error,
            y_error: rec.y_error,
            z_error: rec.z_error,
            satclockerror: rec.satclockerror,
          },
          lowerRec: rec,
          upperRec: null,
          lowerIndex: n - 1,
          upperIndex: null,
          note: "after range - using last sample",
        };
      }

      // otherwise find lower index such that listForSat[i].__date <= simNow < listForSat[i+1].__date
      // a linear scan is fine (datasets are small); if huge, replace with binary search.
      let lowerIdx = 0;
      for (let i = 0; i < n - 1; i++) {
        const t0 = listForSat[i].__date.getTime();
        const t1 = listForSat[i + 1].__date.getTime();
        if (simNowMs >= t0 && simNowMs <= t1) {
          lowerIdx = i;
          break;
        }
      }
      const rec0 = listForSat[lowerIdx];
      const rec1 = listForSat[lowerIdx + 1];

      const t0 = rec0.__date.getTime();
      const t1 = rec1.__date.getTime();
      const denom = t1 - t0;
      const w = denom === 0 ? 0 : (simNowMs - t0) / denom;

      // numeric safe conversion
      const x0 = Number(rec0.x_error ?? 0);
      const x1 = Number(rec1.x_error ?? 0);
      const y0 = Number(rec0.y_error ?? 0);
      const y1 = Number(rec1.y_error ?? 0);
      const z0 = Number(rec0.z_error ?? 0);
      const z1 = Number(rec1.z_error ?? 0);
      const c0 = Number(rec0.satclockerror ?? 0);
      const c1 = Number(rec1.satclockerror ?? 0);

      const interp = {
        x_error: lerp(x0, x1, w),
        y_error: lerp(y0, y1, w),
        z_error: lerp(z0, z1, w),
        satclockerror: lerp(c0, c1, w),
        weight: w,
      };

      return {
        interpValues: interp,
        lowerRec: rec0,
        upperRec: rec1,
        lowerIndex: lowerIdx,
        upperIndex: lowerIdx + 1,
        note: "interpolated",
      };
    }, [simNowMs, listForSat]);

  // displayed values (interpolated or exact)
  const xErr = interpValues ? interpValues.x_error : null;
  const yErr = interpValues ? interpValues.y_error : null;
  const zErr = interpValues ? interpValues.z_error : null;
  const clkErr = interpValues ? interpValues.satclockerror : null;

  // debug strings for visual confirmation (remove for production)
  const debugTimestamp = simNowMs ? new Date(simNowMs).toISOString() : "";
  const lowerTs = lowerRec ? lowerRec.__date.toISOString() : "";
  const upperTs = upperRec ? upperRec.__date.toISOString() : "";
  const debugNote = note ?? "";

  // also log to console once per update to help debugging
  // eslint-disable-next-line no-console
  console.debug("SatelliteInfoCard update:", {
    satName: sat?.name,
    simNow: debugTimestamp,
    note: debugNote,
    lowerIndex,
    upperIndex,
    lowerTs,
    upperTs,
    weight: interpValues?.weight,
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: "3rem",
        left: "3rem",
        zIndex: 1000,
        padding: 16,
        backgroundColor: "rgba(0,30,60,0.95)",
        color: "#9fe7ff",
        border: "1px solid #00aaff",
        borderRadius: 8,
        fontFamily: "Orbitron, sans-serif",
        minWidth: "28vh",
        boxShadow: "0 0 18px rgba(0,170,255,0.07)",
      }}
    >
      <h3 style={{ margin: 0, marginBottom: 8 }}>
        {(sat && sat.name) || "Unknown"}
      </h3>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ fontWeight: 700 }}>x_error</div>
        <div style={{ textAlign: "right" }}>
          {xErr !== null ? fmtNumber(xErr, 6) : "—"}
        </div>

        <div style={{ fontWeight: 700 }}>y_error</div>
        <div style={{ textAlign: "right" }}>
          {yErr !== null ? fmtNumber(yErr, 6) : "—"}
        </div>

        <div style={{ fontWeight: 700 }}>z_error</div>
        <div style={{ textAlign: "right" }}>
          {zErr !== null ? fmtNumber(zErr, 6) : "—"}
        </div>

        <div style={{ fontWeight: 700 }}>sat_clock_error</div>
        <div style={{ textAlign: "right" }}>
          {clkErr !== null ? fmtNumber(clkErr, 6) : "—"}
        </div>
      </div>

      
    </div>
  );
};

export default SatelliteInfoCard;
