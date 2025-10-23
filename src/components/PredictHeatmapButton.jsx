// components/PredictHeatmapButton.jsx
import React from 'react';
import './PredictHeatmapButton.css';

const PredictHeatmapButton = ({ onClick }) => {
  return (
    <div className="predict-button-container">
      <div className="button-hexagons">
        <div className="hexagon"></div>
        <div className="hexagon"></div>
        <div className="hexagon"></div>
        <div className="hexagon"></div>
        <div className="hexagon"></div>
        <div className="hexagon"></div>
      </div>

      <div className="digital-glyphs">
        <div className="digital-glyph">OCEAN.PREDICTION.ENGAGED</div>
        <div className="digital-glyph">MARINE.FORECAST.INIT()</div>
        <div className="digital-glyph">
          01001111 01000011 01000101 01000001 01001110 01010000 01010010 01000101 01000100
        </div>
        <div className="digital-glyph">ALGORITHM.OPTIMIZED</div>
      </div>

      <button className="holo-button predict-button" onClick={onClick}>
        <div className="button-text">PREDICT HEATMAP</div>
        <div className="holo-glow"></div>
        <div className="button-glitch"></div>
        <div className="corner-accents">
          <div className="corner-accent"></div>
          <div className="corner-accent"></div>
          <div className="corner-accent"></div>
          <div className="corner-accent"></div>
        </div>
        <div className="holo-lines">
          <div className="holo-line"></div>
          <div className="holo-line"></div>
          <div className="holo-line"></div>
          <div className="holo-line"></div>
        </div>
        <div className="scan-line"></div>
        <div className="holo-particles">
          <div className="holo-particle"></div>
          <div className="holo-particle"></div>
          <div className="holo-particle"></div>
          <div className="holo-particle"></div>
          <div className="holo-particle"></div>
          <div className="holo-particle"></div>
        </div>
      </button>

      <div className="sound-wave">
        <div className="wave-bar"></div>
        <div className="wave-bar"></div>
        <div className="wave-bar"></div>
        <div className="wave-bar"></div>
        <div className="wave-bar"></div>
        <div className="wave-bar"></div>
        <div className="wave-bar"></div>
        <div className="wave-bar"></div>
        <div className="wave-bar"></div>
        <div className="wave-bar"></div>
        <div className="wave-bar"></div>
        <div className="wave-bar"></div>
        <div className="wave-bar"></div>
        <div className="wave-bar"></div>
        <div className="wave-bar"></div>
      </div>
    </div>
  );
};

export default PredictHeatmapButton;