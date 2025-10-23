// App.jsx
import React, { useRef, useState, useEffect } from "react";
import EarthReal from "./components/EarthReal";
import EarthChaseScene from "./components/EarthChaseScene";
import Loader from "./components/Loader";
import SatelliteInfoCard from "./components/SatelliteInfoCard";
import HeatmapLoader from "./components/HeatmapLoader";
import PredictHeatmapButton from "./components/PredictHeatmapButton";
import RightSidebar from "./components/RightSidebar";
import Timeline from "./components/Timeline";
import oceanData from "./assets/OceanData.json";
import PredictionTable from "./components/PredictionTable";
// Import the new full-screen loader
import EnvironmentLoader from "./components/EnvironmentLoader";

function App() {
  const [selectedSatellite, setSelectedSatellite] = useState(null);
  const [showAllSatellites, setShowAllSatellites] = useState(true);

  // heatmap / simulate UI state
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showHeatmapLoader, setShowHeatmapLoader] = useState(false);
  const [heatmapGenerated, setHeatmapGenerated] = useState(false);

  const [showOceanHeatmap, setShowOceanHeatmap] = useState(false);
  const [isPredictingOcean, setIsPredictingOcean] = useState(false);

  // simulate mode state
  const [simulateMode, setSimulateMode] = useState(false);
  const [simulateTarget, setSimulateTarget] = useState(null); // satellite name

  // Satellite data state from backend
  const [satelliteData, setSatelliteData] = useState(null);
  // This state will now control the full-screen loader
  const [isLoadingSatellites, setIsLoadingSatellites] = useState(true);
  const [satelliteError, setSatelliteError] = useState(null);

  // Filtered satellites passed down to EarthReal
  const [displayedSatellites, setDisplayedSatellites] = useState(null);

  // chase mode
  const [inChaseMode, setInChaseMode] = useState(false);
  const [chaseTarget, setChaseTarget] = useState(null);

  // ---------------------------------------------------------------------------
  // simulation clock and playback
  // ---------------------------------------------------------------------------
  // primary reference time used by the rendering loop (updated every frame)
  const simNowRef = useRef(new Date("2025-09-01T00:00:00"));

  // reactive state copy used to force React re-renders when timeline / sim time changes
  // keep it throttled (we update it at a modest rate to avoid rendering every RAF frame)
  const [simNowState, setSimNowState] = useState(simNowRef.current);

  const [isPlaying, setIsPlaying] = useState(true);
  const [speedMultiplier, setSpeedMultiplier] = useState(1); // 1x,2x,4x,8x

  // Helper: set sim absolute time (used by Timeline).
  // IMPORTANT: we update both the ref and the React state so UI updates immediately.
  const setSimNowAbsolute = (ms) => {
    const dt = new Date(ms);
    simNowRef.current = dt;
    setSimNowState(new Date(dt)); // create fresh Date object to ensure re-render
  };

  // Playback loop: advance the sim clock in real-time when playing.
  // We update simNowRef.current every frame, but only update React state at ~200ms intervals.
  useEffect(() => {
    let mounted = true;
    let lastPerf = performance.now();
    let lastStateUpdatePerf = performance.now();

    const MIN_STATE_UPDATE_MS = 200; // throttle UI updates to ~5 Hz

    const loop = () => {
      if (!mounted) return;
      const nowPerf = performance.now();
      const frameMs = nowPerf - lastPerf;
      lastPerf = nowPerf;

      if (isPlaying) {
        // advance simulation by real elapsed ms * speedMultiplier
        simNowRef.current = new Date(
          simNowRef.current.getTime() + frameMs * speedMultiplier
        );
      }

      // Throttle how often we push simNowRef into React state (to avoid too many re-renders)
      if (nowPerf - lastStateUpdatePerf >= MIN_STATE_UPDATE_MS) {
        lastStateUpdatePerf = nowPerf;
        // update state with a new Date instance so shallow comparisons detect change
        setSimNowState(new Date(simNowRef.current));
      }

      requestAnimationFrame(loop);
    };

    const raf = requestAnimationFrame(loop);
    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
    };
  }, [isPlaying, speedMultiplier]);

  // ---------------------------------------------------------------------------
  // (rest of file unchanged) data fetching, event handlers, simulate flow, etc.
  // ---------------------------------------------------------------------------
  // Fetch satellite data from backend on mount
  useEffect(() => {
    const fetchSatelliteData = async () => {
      try {
        setIsLoadingSatellites(true);
        setSatelliteError(null);

        const API_BASE_URL =
          import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
        const response = await fetch(`${API_BASE_URL}/complete_data?n=10`);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        // backend returns either an array or an object with .satellites
        const arr = Array.isArray(data) ? data : data?.satellites ?? data;
        setSatelliteData(arr);
        setDisplayedSatellites(arr); // initially show all
      } catch (error) {
        console.error("Error fetching satellite data:", error);
        setSatelliteError(error.message);
        setDisplayedSatellites([]);
      } finally {
        setIsLoadingSatellites(false);
      }
    };

    fetchSatelliteData();
  }, []);

  // Listen for 'enter-chase' events (EarthReal can dispatch)
  useEffect(() => {
    const onEnterChase = (e) => {
      try {
        setChaseTarget(e?.detail ?? null);
        setInChaseMode(true);
      } catch (err) {
        // ignore
      }
    };
    window.addEventListener("enter-chase", onEnterChase);
    return () => window.removeEventListener("enter-chase", onEnterChase);
  }, []);

  // Add satellite to master list (called by ControlPanel when search selection gets added)
  const handleAddSatelliteToList = (satellite) => {
    if (!satellite) return;
    setSatelliteData((prev) => {
      const arr = Array.isArray(prev) ? [...prev] : [];
      const exists = arr.some(
        (s) => s.name && satellite.name && s.name === satellite.name
      );
      if (!exists) {
        const newArr = [...arr, satellite];
        // if currently showing all, include the new sat in displayed list as well
        setDisplayedSatellites((prevDisplay) => {
          if (!prevDisplay) return newArr;
          if (showAllSatellites) {
            return [
              ...(Array.isArray(prevDisplay) ? prevDisplay : []),
              satellite,
            ];
          }
          return prevDisplay;
        });
        return newArr;
      }
      return arr;
    });
  };

  // Satellite selection handler from ControlPanel
  const handleSatelliteSelect = (satellite) => {
    if (satellite === "ALL") {
      setShowAllSatellites(true);
      setSelectedSatellite(null);
      setDisplayedSatellites(Array.isArray(satelliteData) ? satelliteData : []);
      return;
    }

    // normalize (satellite might be a string name or an object)
    let satObj = satellite;
    if (typeof satellite === "string") {
      satObj = (Array.isArray(satelliteData) ? satelliteData : []).find(
        (s) => (s?.name || "").toString() === satellite.toString()
      );
    }

    if (!satObj) {
      console.warn("Selected satellite not found:", satellite);
      return;
    }

    setSelectedSatellite(satObj);
    setShowAllSatellites(false);
    setDisplayedSatellites([satObj]);

    // clear heatmap/sim states if any
    setShowHeatmap(false);
    setShowOceanHeatmap(false);
    setHeatmapGenerated(false);
    setIsPredictingOcean(false);
    setSimulateMode(false);
    setSimulateTarget(null);
  };

  // START simulate flow: show loader first, then when loader completes we enable simulateMode
  const handleGenerateHeatmap = () => {
    // only start simulation if a satellite is selected
    if (selectedSatellite && selectedSatellite.name) {
      // ensure displayed satellites shows only the selected sat when simulating
      setDisplayedSatellites([selectedSatellite]);
      setShowAllSatellites(false);

      // show loader with "Simulating prediction"
      setShowHeatmapLoader(true);

      // set which satellite we want to simulate once loader completes
      setSimulateTarget(selectedSatellite.name);
      // do not set simulateMode true yet — wait for loader to finish
    } else {
      // nothing selected — toggle nothing or show warning (we keep previous behavior)
      console.warn("No satellite selected to simulate.");
    }
  };

  // Called by HeatmapLoader when it's finished
  const handleHeatmapGenerationComplete = () => {
    setShowHeatmapLoader(false);
    // Enter simulate mode now: EarthReal will draw corrected orbit when simulateMode=true and simulateTarget set
    setSimulateMode(true);
    setShowHeatmap(true);
    setHeatmapGenerated(true);

    // Optionally: set simNowRef to midnight of 2025-09-08 so timeline starts at 00:00 of that date
    const dt = new Date("2025-09-08T00:00:00");
    simNowRef.current = dt;
    setSimNowState(new Date(dt));
    setIsPlaying(true);
  };

  const handlePredictHeatmap = () => {
    setIsPredictingOcean(true);
  };

  const handleOceanPredictionComplete = () => {
    setIsPredictingOcean(false);
    setShowOceanHeatmap(true);
  };

  // Exit simulate mode helper (could be triggered by a UI button later)
  const exitSimulateMode = () => {
    setSimulateMode(false);
    setSimulateTarget(null);
    // restore default displayed satellites (show all)
    setDisplayedSatellites(Array.isArray(satelliteData) ? satelliteData : []);
    setShowAllSatellites(true);
    setShowHeatmap(false);
    setHeatmapGenerated(false);
  };

  // Legend styling and UI (top-center)
  const legendStyle = {
    position: "absolute",
    left: "50%",
    top: 12,
    transform: "translateX(-50%)",
    zIndex: 999,
    display: "flex",
    gap: 12,
    alignItems: "center",
    padding: "6px 12px",
    borderRadius: 10,
    background: "rgba(0,0,0,0.45)",
    border: "1px solid rgba(255,255,255,0.04)",
    color: "#fff",
    fontSize: 13,
    fontFamily:
      "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  };

  const colorSwatch = (color) => ({
    width: 12,
    height: 12,
    borderRadius: 3,
    background: color,
    border: "1px solid rgba(255,255,255,0.06)",
    boxShadow: "0 2px 8px rgba(0,0,0,0.6)",
  });

  // --- NEW: Conditional Rendering Logic ---
  // Show full-screen loader while satellites are fetching
  if (isLoadingSatellites) {
    return <EnvironmentLoader message="Loading Environment..." />;
  }

  // Show full-screen error if fetching failed
  if (satelliteError) {
    return (
      <EnvironmentLoader
        message={`Error loading satellite data: ${satelliteError}. Please try refreshing.`}
        isError={true}
      />
    );
  }

  // If loaded and no error, return the main app UI
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#000",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Legend */}
      {simulateMode ? (
        <div style={legendStyle}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={colorSwatch("#00aaff")} />
            <div>Actual orbit</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={colorSwatch("#00ff00")} />
            <div>Corrected orbit</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={colorSwatch("#ff3333")} />
            <div>Error vector</div>
          </div>

          <button
            onClick={exitSimulateMode}
            style={{
              marginLeft: 12,
              padding: "6px 10px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.06)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.06)",
              cursor: "pointer",
            }}
            title="Exit simulate mode"
          >
            Exit simulate
          </button>
        </div>
      ) : null}

      <Loader
        onSatelliteSelect={handleSatelliteSelect}
        selectedSatellite={selectedSatellite}
        showAllSatellites={showAllSatellites}
        onGenerateHeatmap={handleGenerateHeatmap}
        satelliteData={satelliteData}
        // isLoadingSatellites prop is no longer needed here
        onAddSatellite={handleAddSatelliteToList}
      />

      {!inChaseMode && (
        <EarthReal
          satelliteData={displayedSatellites}
          // isLoadingSatellites and satelliteError props removed
          // as this component only renders after data is loaded (or empty)
          showHeatmap={showHeatmap}
          showOceanHeatmap={showOceanHeatmap}
          // pass the simulation/timeline clock (so timeline controls everything)
          simNowRefProp={simNowRef}
          // simulate overlay props
          simulateMode={simulateMode}
          simulateTargetName={simulateTarget}
        />
      )}
      {inChaseMode && <EarthChaseScene target={chaseTarget} />}

      {/* Pass reactive simNowState to SatelliteInfoCard so it updates with timeline/playback */}
      {selectedSatellite && (
        <SatelliteInfoCard sat={selectedSatellite} simNow={simNowState} />
      )}

      <PredictionTable simulateMode={simulateMode} simNow={simNowState} />

      <HeatmapLoader
        isVisible={showHeatmapLoader}
        onComplete={handleHeatmapGenerationComplete}
        message="Simulating prediction"
      />

      <HeatmapLoader
        isVisible={isPredictingOcean}
        onComplete={handleOceanPredictionComplete}
        message="Predicting Heatmap"
      />

      {heatmapGenerated && !simulateMode && (
        <PredictHeatmapButton onClick={handlePredictHeatmap} />
      )}

      <Timeline
        simNowRef={simNowRef}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        speedMultiplier={speedMultiplier}
        setSpeedMultiplier={setSpeedMultiplier}
        setSimNowAbsolute={setSimNowAbsolute}
        timelineDates={simulateMode ? ["2025-09-08"] : null}
      />
    </div>
  );
}

export default App;
