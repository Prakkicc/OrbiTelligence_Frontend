import React from "react";
import "./AnimatedRings.css";

const AnimatedRings = ({ size = 300 }) => {
  // Uniform border thickness relative to size
  const thickness = size * 0.05; // 5% of size

  return (
    <div
      className="frame"
      style={{ width: size, height: size }}
    >
      <div
        className="ring ring-1"
        style={{ borderWidth: thickness }}
      ></div>
      <div
        className="ring ring-2"
        style={{ borderWidth: thickness }}
      ></div>
      <div
        className="ring ring-3"
        style={{ borderWidth: thickness }}
      ></div>
    </div>
  );
};

export default AnimatedRings;
