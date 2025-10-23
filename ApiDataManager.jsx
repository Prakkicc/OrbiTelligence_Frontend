import React, { useState, useEffect } from 'react';

// A simple CSS-in-JS for styling to keep it all in one file


/**
 * @description Custom hook to manage fetching and processing satellite data.
 * It simulates a sequence of API calls required for the analysis pipeline.
 * @param {string|number} satelliteId - The NORAD Catalog Number for the satellite.
 */
const useSatelliteData = (satelliteId) => {
  const [status, setStatus] = useState('Idle. Pending initialization...');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const BASE_URL = 'https://debri-aware-co-pilot-sih-2025-module-a.onrender.com';

  useEffect(() => {
    // This function orchestrates the series of API calls.
    const runAnalysisPipeline = async () => {
      setIsLoading(true);
      setError(null);

      const Delay = (ms) => new Promise(res => setTimeout(res, ms));

      try {
        // --- Step 1: Fetch initial data (GET requests) ---
        setStatus(`Fetching TLE data for satellite ${satelliteId}...`);
        await fetch(`https://celestrak.org/NORAD/elements/gp.php?CATNR=${satelliteId}&FORMAT=TLE`);
        await Delay(700);

        setStatus(`Fetching trajectory forecast for satellite ${satelliteId}...`);
        await fetch(`${BASE_URL}/trajectory/${satelliteId}`);
        await Delay(900);

        setStatus(`Fetching re-entry prediction for satellite ${satelliteId}...`);
        await fetch(`${BASE_URL}/reentry/${satelliteId}`);
        await Delay(800);

        setStatus(`Fetching potential collision candidates for satellite ${satelliteId}...`);
        await fetch(`${BASE_URL}/candidates/${satelliteId}`);
        await Delay(1200);

        // --- Step 2: Run processing (POST requests) ---
        setStatus('All initial data fetched. Initiating analysis pipeline...');
        await fetch(`${BASE_URL}/run_pipeline/${satelliteId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: "start_analysis" }),
        });
        await Delay(1500);

        setStatus('Pipeline complete. Scoring collision candidates...');
        await fetch(`${BASE_URL}/score_candidates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ satelliteId: satelliteId, model: "advanced_v2" }),
        });
        await Delay(1000);

        // --- Step 3: Finalize ---
        setStatus('Analysis complete. All data processed successfully.');

      } catch (err) {
        console.error("Simulated API call failed:", err);
        setError(`A network error occurred during the simulation. This is expected if APIs are not configured for this origin.`);
        setStatus('Pipeline halted due to a network error.');
      } finally {
        setIsLoading(false);
      }
    };

    runAnalysisPipeline();
  }, [satelliteId]); // Rerun if the satelliteId changes

  return { status, isLoading, error };
};


/**
 * @description This component displays the status of the satellite data processing pipeline.
 */
const ApiDataManager = () => {
  const SATELLITE_ID = 25544; // ISS (ZARYA)
  const { status, isLoading, error } = useSatelliteData(SATELLITE_ID);

  const getStatusStyle = () => {
    if (error) return styles.error;
    if (!isLoading && !error) return styles.success;
    return styles.loading;
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Satellite Analysis Pipeline</h3>
      <p>
        <strong>Target Satellite: </strong>
        <code style={styles.code}>NORAD ID {SATELLITE_ID}</code>
      </p>
      <div style={{ ...styles.status, ...getStatusStyle() }}>
        <strong>Status: </strong>{status}
      </div>
    </div>
  );
};

export default ApiDataManager;