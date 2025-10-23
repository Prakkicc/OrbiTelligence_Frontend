import React from 'react';
import './HoloButton.css';

const HoloButton = ({ onClick, label = "GENERATE HEATMAP" }) => {
  return (
    <div className="button-container">
      <div className="button-hexagons">
        <div className="hexagon"></div>
        <div className="hexagon"></div>
        <div className="hexagon"></div>
        <div className="hexagon"></div>
        <div className="hexagon"></div>
        <div className="hexagon"></div>
      </div>

      <div className="digital-glyphs">
        <div className="digital-glyph">0x89F2 EXEC PROTOCOL</div>
        <div className="digital-glyph">SYS.QUANTUM.INIT()</div>
        <div className="digital-glyph">
          01011010 01000001 01010000 01010101 01010011 01001011
        </div>
        <div className="digital-glyph">HOLO-CONN INITIALIZED</div>
      </div>

      <button className="holo-button" onClick={onClick}>
        <div className="button-text">{label}</div>
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

export default HoloButton;