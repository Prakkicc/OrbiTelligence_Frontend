// components/HeatmapLoader.jsx  (robust against parent re-renders)
import React, { useEffect, useRef, useState } from "react";
import "./HeatmapLoader.css";

const DEFAULT_STEPS = [
  { value: 15, delay: 800 },
  { value: 29, delay: 1200 },
  { value: 32, delay: 500 },
  { value: 46, delay: 1000 },
  { value: 49, delay: 400 },
  { value: 52, delay: 300 },
  { value: 78, delay: 1500 },
  { value: 83, delay: 600 },
  { value: 91, delay: 900 },
  { value: 95, delay: 500 },
  { value: 97, delay: 400 },
  { value: 99, delay: 700 },
  { value: 100, delay: 1200 },
];

const HeatmapLoader = ({ isVisible, onComplete, message = "Generating Heatmap", steps = DEFAULT_STEPS }) => {
  const [progress, setProgress] = useState(0);
  const timersRef = useRef([]);
  const mountedRef = useRef(false);

  // keep the latest onComplete and steps in refs so effect doesn't depend on their identity
  const onCompleteRef = useRef(onComplete);
  const stepsRef = useRef(steps);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // clear previous timers
    const clearAll = () => {
      (timersRef.current || []).forEach((id) => clearTimeout(id));
      timersRef.current = [];
    };
    clearAll();

    if (!isVisible) {
      setProgress(0);
      return () => clearAll();
    }

    // schedule timers deterministically based on the current stepsRef value
    const localSteps = Array.isArray(stepsRef.current) && stepsRef.current.length ? stepsRef.current : DEFAULT_STEPS;

    let cumulative = 0;
    localSteps.forEach((step, idx) => {
      cumulative += Number(step.delay || 0);
      const id = setTimeout(() => {
        if (!mountedRef.current) return;
        setProgress(step.value);

        // last step -> call onComplete if present
        if (idx === localSteps.length - 1) {
          // call latest onComplete if still mounted
          const cb = onCompleteRef.current;
          if (mountedRef.current && typeof cb === "function") {
            // schedule next tick for safety
            setTimeout(() => {
              if (mountedRef.current) cb();
            }, 10);
          }
        }
      }, cumulative);

      timersRef.current.push(id);
    });

    return () => {
      clearAll();
    };
  }, [isVisible]); // ONLY depend on isVisible to avoid repeat clearing from parent re-renders

  if (!isVisible) return null;

  return (
    <div className="heatmap-loader-overlay">
      <div className="heatmap-loader-container">
        <div className="heatmap-loader-spinner">
          <div className="spinner-ring" />
          <div className="spinner-ring" />
          <div className="spinner-ring" />
          <div className="spinner-center" />
        </div>

        <div className="heatmap-loader-text">
          <span className="generating-text">{message}</span>

          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>

          <span className="progress-text">{Math.round(progress)}%</span>
        </div>
      </div>
    </div>
  );
};

export default HeatmapLoader;
