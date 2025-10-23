import React, { useState, useEffect } from 'react';
import './AudioVisualizer.css';

const AudioVisualizer = ({ data = [], blockCount = 20 }) => {
  const [bars, setBars] = useState([]);

  useEffect(() => {
    // Exit early if there's no data to prevent errors
    if (!data || data.length === 0) {
      setBars([]);
      return;
    }

    // Find the maximum value in the dataset to scale against
    const maxValue = Math.max(...data);
    
    // Scale each data point to fit the number of blocks
    const newBars = data.map(value => {
      // Calculate the proportion (0 to 1) and scale by blockCount
      // Use Math.ceil to ensure even small values are visible
      return Math.ceil((value / maxValue) * blockCount);
    });

    setBars(newBars);

  }, [data, blockCount]); // Re-run this effect whenever data or blockCount changes

  return (
    <div className="visualizer-container">
      {bars.map((activeBlocks, barIndex) => (
        <div key={barIndex} className="visualizer-bar">
          {Array.from({ length: blockCount }).map((_, blockIndex) => (
            <div
              key={blockIndex}
              className={`visualizer-block ${
                blockIndex < activeBlocks ? "active" : ""
              }`}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

export default AudioVisualizer;