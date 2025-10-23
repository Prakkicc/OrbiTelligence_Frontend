// src/components/PredictionTable.jsx
import React, { useMemo, useState } from "react";
// adjust path if your assets folder is elsewhere
import predictedRaw from "../assets/PredictedData.json";

const TABLE_INITIAL_ROWS = 15;

function formatNumber(x, digits = 6) {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  return Number(x).toFixed(digits);
}

function formatUTCString(utcStr) {
  if (!utcStr) return "—";
  // expect "YYYY-MM-DD hh:mm:ss"
  try {
    const d = new Date(utcStr.replace(" ", "T") + "Z");
    return d.toISOString().replace("T", " ").replace(".000Z", "");
  } catch {
    return utcStr;
  }
}

const PredictionTable = ({ simulateMode = false, simNow = null }) => {
  const [expanded, setExpanded] = useState(false);

  // parse and sort predictions once
  const data = useMemo(() => {
    if (!Array.isArray(predictedRaw)) return [];
    return predictedRaw
      .map((r) => {
        const utc = String(r.utctime || "").trim();
        const date = utc ? new Date(utc.replace(" ", "T") + "Z") : null;
        return {
          ...r,
          __date: date,
        };
      })
      .filter(
        (r) => r.__date instanceof Date && !Number.isNaN(r.__date.getTime())
      )
      .sort((a, b) => a.__date - b.__date);
  }, []);

  // find index of row closest to simNow (ms)
  const simNowMs = simNow instanceof Date ? simNow.getTime() : null;
  const closestIdx = useMemo(() => {
    if (simNowMs === null || data.length === 0) return -1;
    let best = -1;
    let bestDiff = Infinity;
    for (let i = 0; i < data.length; i++) {
      const t = data[i].__date.getTime();
      const d = Math.abs(t - simNowMs);
      if (d < bestDiff) {
        bestDiff = d;
        best = i;
      }
    }
    return best;
  }, [simNowMs, data]);

  if (!simulateMode) return null;

  // visible rows
  const visibleCount = expanded
    ? data.length
    : Math.min(TABLE_INITIAL_ROWS, data.length);
  const visibleRows = data.slice(0, visibleCount);

  // styles (inline to avoid depending on external CSS)
  const cardStyle = {
    position: "fixed",
    right: 20,
    top: "10%",
    width: "30vw",
    minWidth: 320,
    height: "80vh",
    maxHeight: "80vh",
    background:
      "linear-gradient(180deg, rgba(4, 26, 54, 0.95), rgba(6, 45, 88, 0.92))",
    border: "2px solid rgba(0,170,255,0.25)",
    borderRadius: 16,
    padding: 16,
    color: "#c6f3ff",
    boxShadow:
      "0 12px 40px rgba(0,0,0,0.8), 0 0 20px rgba(0,170,255,0.15), inset 0 1px 0 rgba(255,255,255,0.05)",
    zIndex: 2200,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    fontFamily: "Orbitron, sans-serif",
    backdropFilter: "blur(10px)",
  };

  const headerStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingBottom: 10,
    borderBottom: "1px solid rgba(0,170,255,0.15)",
    background:
      "linear-gradient(90deg, rgba(0,170,255,0.1), rgba(0,170,255,0.05))",
    margin: -16,
    marginBottom: 0,
    padding: "14px 16px",
    borderRadius: "16px 16px 0 0",
  };

  const titleStyle = {
    fontSize: 18,
    letterSpacing: 2,
    color: "#9fe7ff",
    fontWeight: "700",
    textShadow: "0 0 10px rgba(0,170,255,0.7)",
    textTransform: "uppercase",
  };

  const tableWrap = {
    overflowY: "auto",
    flex: 1,
    marginTop: 6,
    paddingRight: 6,
  };

  const tableStyle = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  };

  const thStyle = {
    textAlign: "left",
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(160,250,255,0.95)",
    padding: "12px 8px",
    borderBottom: "2px solid rgba(0,170,255,0.3)",
    position: "sticky",
    top: 0,
    background:
      "linear-gradient(180deg, rgba(0,30,60,0.95), rgba(0,20,40,0.93))",
    zIndex: 2,
    letterSpacing: 1,
    textTransform: "uppercase",
  };

  const trStyle = {
    transition: "all 120ms ease",
  };

  const tdStyle = {
    padding: "12px 8px",
    color: "#dffeff",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    fontSize: 13,
    fontWeight: "500",
  };

  const highlightStyle = {
    background:
      "linear-gradient(90deg, rgba(0,200,255,0.15), rgba(0,200,150,0.08))",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(255,255,255,0.05)",
    borderLeft: "4px solid rgba(0,200,255,0.9)",
    borderRight: "1px solid rgba(0,200,255,0.2)",
  };

  const showMoreBtn = {
    marginTop: 12,
    padding: "10px 20px",
    borderRadius: 10,
    border: "1px solid rgba(0,170,255,0.3)",
    background:
      "linear-gradient(90deg, rgba(0,170,255,0.1), rgba(0,170,255,0.05))",
    color: "#9fe7ff",
    cursor: "pointer",
    alignSelf: "center",
    fontFamily: "Orbitron, sans-serif",
    fontWeight: "600",
    letterSpacing: 1,
    fontSize: 12,
    textTransform: "uppercase",
    transition: "all 0.2s ease",
    boxShadow: "0 0 12px rgba(0,170,255,0.2)",
  };

  const footerNote = {
    fontSize: 11,
    color: "rgba(160,250,255,0.7)",
    textAlign: "center",
    paddingTop: 8,
    fontStyle: "italic",
  };

  // Enhanced scrollbar styling
  const scrollbarStyle = `
    .prediction-table-scroll::-webkit-scrollbar { width: 10px; }
    .prediction-table-scroll::-webkit-scrollbar-track { 
      background: rgba(0,30,60,0.4); 
      border-radius: 5px;
    }
    .prediction-table-scroll::-webkit-scrollbar-thumb { 
      background: linear-gradient(rgba(0,170,255,0.6), rgba(0,170,255,0.3)); 
      border-radius: 5px; 
      border: 1px solid rgba(0,170,255,0.1);
    }
    .prediction-table-scroll::-webkit-scrollbar-thumb:hover { 
      background: linear-gradient(rgba(0,200,255,0.8), rgba(0,200,255,0.5));
    }
  `;

  return (
    <div style={cardStyle} role="region" aria-label="Prediction Table">
      <style>{scrollbarStyle}</style>

      <div style={headerStyle}>
        <div style={titleStyle}>PREDICTION TABLE</div>
        <div
          style={{
            fontSize: 12,
            color: "rgba(160,250,255,0.8)",
            fontWeight: "600",
            letterSpacing: 0.5,
          }}
        >
          {expanded ? `${data.length} rows` : `${visibleCount}/${data.length}`}
        </div>
      </div>

      <div style={tableWrap} className="prediction-table-scroll">
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>UTC Time</th>
              <th style={{ ...thStyle, textAlign: "right" }}>X Error</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Y Error</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Z Error</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Clock Error</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r, i) => {
              const globalIndex = i;
              const overallIndex = expanded ? i : i;
              const highlight =
                closestIdx >= 0 &&
                data[overallIndex] &&
                data[overallIndex].__date
                  ? Math.abs(data[overallIndex].__date.getTime() - simNowMs) ===
                    Math.min(
                      ...data.map((d) =>
                        Math.abs(d.__date.getTime() - (simNowMs || 0))
                      )
                    )
                  : false;

              return (
                <tr
                  key={r.utctime + i}
                  style={{
                    ...trStyle,
                    ...(highlight ? highlightStyle : {}),
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    if (!highlight) {
                      e.currentTarget.style.background = "rgba(0,170,255,0.05)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!highlight) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  <td style={tdStyle}>{formatUTCString(r.utctime)}</td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: "right",
                      fontFamily: "monospace",
                    }}
                  >
                    {formatNumber(r.x_error, 6)}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: "right",
                      fontFamily: "monospace",
                    }}
                  >
                    {formatNumber(r.y_error, 6)}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: "right",
                      fontFamily: "monospace",
                    }}
                  >
                    {formatNumber(r.z_error, 6)}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: "right",
                      fontFamily: "monospace",
                    }}
                  >
                    {formatNumber(r.satclockerror, 6)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        {data.length > TABLE_INITIAL_ROWS ? (
          <button
            onClick={() => setExpanded((s) => !s)}
            style={showMoreBtn}
            aria-expanded={expanded}
            onMouseEnter={(e) => {
              e.target.style.background =
                "linear-gradient(90deg, rgba(0,170,255,0.2), rgba(0,170,255,0.1))";
              e.target.style.boxShadow = "0 0 15px rgba(0,170,255,0.3)";
            }}
            onMouseLeave={(e) => {
              e.target.style.background =
                "linear-gradient(90deg, rgba(0,170,255,0.1), rgba(0,170,255,0.05))";
              e.target.style.boxShadow = "0 0 12px rgba(0,170,255,0.2)";
            }}
          >
            {expanded ? "Show Less" : "Show More"}
          </button>
        ) : null}
      </div>

      
    </div>
  );
};

export default PredictionTable;
