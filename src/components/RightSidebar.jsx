import React, { useState, useEffect } from 'react';
import './RightSidebar.css';

import AudioVisualizer from './RightSideBar/AudioVisualizer';
import EarthHologram from './RightSideBar/EarthHologram';
import AnimatedRings from './RightSideBar/AnimatedRings';

// 1. Define the initial data outside the component.
// This serves as a baseline for our random fluctuations.
const initialSpaceWeatherData = {
  atmospheric_density: {
    correction_factor: '1.34x MSIS',
    uncertainty: '±15%',
    temperature: [1200, 800, 250, 190, 50],
  },
  kp_index: {
    current: 4.2,
    forecast_6h: [3.8, 4.1, 4.5],
    alert_level: 'Moderate Storm',
  },
  solar_wind: {
    speed: '485 km/s',
    density: '7.2 p/cm³',
    imf_bz: '-8.3 nT southward',
  },
};


const RightSidebar = () => {
  // 2. Use useState to make the data dynamic.
  const [spaceWeatherData, setSpaceWeatherData] = useState(initialSpaceWeatherData);

  // 3. Use useEffect to update the data every 5 seconds.
  useEffect(() => {
    const interval = setInterval(() => {
      // Create a function to generate new, slightly randomized data
      const getUpdatedData = () => {
        // Fluctuate temperature by up to +/- 5% of the original value
        const newTemperature = initialSpaceWeatherData.atmospheric_density.temperature.map(
          temp => Math.round(temp + (Math.random() - 0.5) * (temp * 0.1))
        );

        // Fluctuate other values similarly
        const newKpIndex = (initialSpaceWeatherData.kp_index.current + (Math.random() - 0.5) * 0.5).toFixed(1);
        const baseSpeed = parseInt(initialSpaceWeatherData.solar_wind.speed);
        const newSpeed = `${Math.round(baseSpeed + (Math.random() - 0.5) * 25)} km/s`;
        
        // Return a new state object
        return {
          ...initialSpaceWeatherData, // Start with a fresh copy of the original
          atmospheric_density: {
            ...initialSpaceWeatherData.atmospheric_density,
            temperature: newTemperature,
          },
          kp_index: {
            ...initialSpaceWeatherData.kp_index,
            current: newKpIndex,
          },
          solar_wind: {
            ...initialSpaceWeatherData.solar_wind,
            speed: newSpeed,
          },
        };
      };
      
      setSpaceWeatherData(getUpdatedData());

    }, 1000); // 5000 milliseconds = 5 seconds

    // Cleanup: clear the interval when the component unmounts to prevent memory leaks
    return () => clearInterval(interval);
  }, []); // The empty array [] ensures this effect runs only once on component mount

  return (
    <div className="sidebar-container">
      {/* Item 1: Audio Visualizer + Atmospheric Density Data */}
      <div className="sidebar-item">
        <AudioVisualizer 
          data={spaceWeatherData.atmospheric_density.temperature} 
          blockCount={22} 
        />
        <div className="item-data">
          <h4>Atmospheric Density</h4>
          <p>
            <span>Correction:</span> {spaceWeatherData.atmospheric_density.correction_factor}
          </p>
          <p>
            <span>Uncertainty:</span> {spaceWeatherData.atmospheric_density.uncertainty}
          </p>
           <p>
            <span>Temp (C):</span> {spaceWeatherData.atmospheric_density.temperature.join(' | ')}
          </p>
        </div>
      </div>

      {/* Item 2: Earth Hologram + Kp Index Data */}
      <div className="sidebar-item">
        <EarthHologram />
        <div className="item-data">
          <h4>Kp Index</h4>
          <p>
            <span>Current:</span> {spaceWeatherData.kp_index.current}
          </p>
          <p>
            <span>Forecast:</span> {spaceWeatherData.kp_index.forecast_6h.join(', ')}
          </p>
          <p>
            <span>Alert:</span> {spaceWeatherData.kp_index.alert_level}
          </p>
        </div>
      </div>

      {/* Item 3: Animated Rings + Solar Wind Data */}
      <div className="sidebar-item">
        <AnimatedRings size={75} />
        <div className="item-data">
          <h4>Solar Wind</h4>
          <p>
            <span>Speed:</span> {spaceWeatherData.solar_wind.speed}
          </p>
          <p>
            <span>Density:</span> {spaceWeatherData.solar_wind.density}
          </p>
          <p>
            <span>IMF Bz:</span> {spaceWeatherData.solar_wind.imf_bz}
          </p>
        </div>
      </div>
    </div>
  );
};

export default RightSidebar;