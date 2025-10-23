// EarthGlobe.jsx - Enhanced ocean heatmap coverage
import React, { useRef, useState, useEffect, useMemo } from "react";
import Globe from "react-globe.gl";
import satelliteData from "../assets/SatelliteSample.json";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import satelliteGLB from "../assets/tdrs.glb";

// Textures
const EARTH_DAY_TEXTURE = "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg";
const EARTH_NIGHT_TEXTURE = "https://unpkg.com/three-globe/example/img/earth-night.jpg";
const CLOUDS_TEXTURE = "https://clouds.matteason.co.uk/images/8192x4096/clouds-alpha.png";
const BACKGROUND_IMAGE = "https://unpkg.com/three-globe/example/img/night-sky.png";

// Orbit path generator
const generateOrbitPath = (altitude, inclination, raan, points = 100) => {
  const path = [];
  const radius = 1 + altitude;
  const incRad = (inclination * Math.PI) / 180;
  const raanRad = (raan * Math.PI) / 180;

  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2;
    let x = radius * Math.cos(angle);
    let y = radius * Math.sin(angle);
    let z = 0;

    let yInc = y * Math.cos(incRad) - z * Math.sin(incRad);
    let zInc = y * Math.sin(incRad) + z * Math.cos(incRad);

    let xFinal = x * Math.cos(raanRad) - yInc * Math.sin(raanRad);
    let yFinal = x * Math.sin(raanRad) + yInc * Math.cos(raanRad);
    let zFinal = zInc;

    const lat = (Math.asin(zFinal / radius) * 180) / Math.PI;
    const lng = (Math.atan2(yFinal, xFinal) * 180) / Math.PI;

    path.push({ lat, lng, alt: altitude });
  }
  return path;
};

// Function to generate focused heatmap points in a single region below trajectory
const generateFocusedHeatmapPoints = (orbitPath, count = 50) => {
  const points = [];
  
  // Select a single point along the orbit path to focus on
  const focusIndex = Math.floor(orbitPath.length * 0.25);
  const focusPoint = orbitPath[focusIndex];
  
  // Generate points concentrated around this focus point
  for (let i = 0; i < count; i++) {
    const distanceFromCenter = Math.random() * 2;
    const angle = Math.random() * Math.PI * 2;
    
    const latOffset = Math.sin(angle) * distanceFromCenter;
    const lngOffset = Math.cos(angle) * distanceFromCenter;
    
    const centerDistance = Math.sqrt(latOffset * latOffset + lngOffset * lngOffset);
    const weight = 0.8 - (centerDistance / 2) * 0.6;
    
    points.push({
      lat: focusPoint.lat + latOffset,
      lng: focusPoint.lng + lngOffset,
      weight: Math.max(0.2, weight),
      satelliteId: focusPoint.id,
      type: 'satellite' // Add type to distinguish
    });
  }
  
  return points;
};

// Function to generate ocean heatmap points with wider coverage
const generateOceanHeatmapPoints = (oceanDataPoints, countMultiplier = 10, spreadFactor = 1.5) => {
  const points = [];
  
  // For each ocean data point, generate multiple points with wider spread
  oceanDataPoints.forEach(point => {
    // Generate more points for better coverage
    for (let i = 0; i < countMultiplier; i++) {
      // Add more spread to cover a larger area
      const latOffset = (Math.random() - 0.5) * spreadFactor;
      const lngOffset = (Math.random() - 0.5) * spreadFactor;
      
      // Slightly vary the weight for visual interest
      const weightVariation = 0.1 * (Math.random() - 0.5);
      const weight = Math.max(0.2, Math.min(1, point.weight + weightVariation));
      
      points.push({
        lat: point.lat + latOffset,
        lng: point.lng + lngOffset,
        weight: weight,
        type: 'ocean'
      });
    }
  });
  
  return points;
};

const EarthGlobe = ({ selectedSatellite, showAllSatellites, showHeatmap, showOceanHeatmap, oceanData }) => {
  const globeRef = useRef();
  const [threeGlobe, setThreeGlobe] = useState(null);
  const [satellitePositions, setSatellitePositions] = useState([]);
  const [orbitPaths, setOrbitPaths] = useState([]);
  const [satelliteModel, setSatelliteModel] = useState(null);
  const [earthTexture, setEarthTexture] = useState(EARTH_DAY_TEXTURE);
  const [allHeatmapPoints, setAllHeatmapPoints] = useState([]);

  // Filter satellites based on selection
  const filteredSatellites = useMemo(() => {
    if (showAllSatellites) {
      return satelliteData.satellites;
    } else if (selectedSatellite) {
      return [selectedSatellite];
    } else {
      return [];
    }
  }, [selectedSatellite, showAllSatellites]);

  // Update earth texture and atmosphere based on heatmap state
  useEffect(() => {
    if (showHeatmap) {
      setEarthTexture(EARTH_NIGHT_TEXTURE);
    } else if (showOceanHeatmap) {
      setEarthTexture(EARTH_NIGHT_TEXTURE);
    } else {
      setEarthTexture(EARTH_DAY_TEXTURE);
    }
  }, [showHeatmap, showOceanHeatmap]);

  // Combine heatmap data based on current state - BOTH can be shown now
  useEffect(() => {
    let combinedPoints = [];
    
    // Add satellite heatmap points if showHeatmap is true
    if (showHeatmap && orbitPaths.length > 0) {
      const satelliteHeatmaps = orbitPaths.flatMap(path => 
        generateFocusedHeatmapPoints(path.points)
      );
      combinedPoints = [...combinedPoints, ...satelliteHeatmaps];
    }
    
    // Add ocean heatmap points if showOceanHeatmap is true and we have a selected satellite
    if (showOceanHeatmap && selectedSatellite && oceanData) {
      const satelliteId = selectedSatellite.id.toString();
      if (oceanData[satelliteId]) {
        // Generate ocean heatmap points with wider coverage
        const oceanPoints = generateOceanHeatmapPoints(oceanData[satelliteId], 15, 2.0);
        combinedPoints = [...combinedPoints, ...oceanPoints];
      }
    }
    
    setAllHeatmapPoints(combinedPoints);
  }, [showHeatmap, showOceanHeatmap, selectedSatellite, oceanData, orbitPaths]);

  // Add Earth rotation animation
  useEffect(() => {
    if (!globeRef.current) return;

    const animate = () => {
      if (globeRef.current && globeRef.current.controls()) {
        globeRef.current.controls().autoRotate = true;
        globeRef.current.controls().autoRotateSpeed = 0.3;
      }
      requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (globeRef.current && globeRef.current.controls()) {
        globeRef.current.controls().autoRotate = false;
      }
    };
  }, []);

  // Load GLB model
  useEffect(() => {
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");
    loader.setDRACOLoader(dracoLoader);

    loader.load(
      satelliteGLB,
      (gltf) => {
        gltf.scene.scale.set(0.3, 0.3, 0.3);
        setSatelliteModel(gltf.scene);
      },
      undefined,
      (error) => {
        console.error("Error loading GLB model:", error);
        setSatelliteModel("error");
      }
    );
  }, []);

  // Generate orbit paths + initial positions for filtered satellites
  useEffect(() => {
    const paths = filteredSatellites.map((sat) => ({
      ...sat,
      points: generateOrbitPath(sat.altitude, sat.inclination, sat.raan),
    }));
    setOrbitPaths(paths);

    const initialSats = filteredSatellites.map((sat) => {
      const angle = sat.orbitOffset;
      const radius = 1 + sat.altitude;
      const incRad = (sat.inclination * Math.PI) / 180;
      const raanRad = (sat.raan * Math.PI) / 180;

      let x = radius * Math.cos(angle);
      let y = radius * Math.sin(angle);
      let z = 0;

      let yInc = y * Math.cos(incRad) - z * Math.sin(incRad);
      let zInc = y * Math.sin(incRad) + z * Math.cos(incRad);

      let xFinal = x * Math.cos(raanRad) - yInc * Math.sin(raanRad);
      let yFinal = x * Math.sin(raanRad) + yInc * Math.cos(raanRad);
      let zFinal = zInc;

      const lat = (Math.asin(zFinal / radius) * 180) / Math.PI;
      const lng = (Math.atan2(yFinal, xFinal) * 180) / Math.PI;

      return { ...sat, lat, lng };
    });
    setSatellitePositions(initialSats);
  }, [filteredSatellites]);

  // Animate only the filtered satellites
  useEffect(() => {
    const animateSatellites = () => {
      const time = Date.now() / 1000;

      const updatedSats = filteredSatellites.map((sat) => {
        const angle = time * sat.orbitSpeed + sat.orbitOffset;
        const radius = 1 + sat.altitude;
        const incRad = (sat.inclination * Math.PI) / 180;
        const raanRad = (sat.raan * Math.PI) / 180;

        let x = radius * Math.cos(angle);
        let y = radius * Math.sin(angle);
        let z = 0;

        let yInc = y * Math.cos(incRad) - z * Math.sin(incRad);
        let zInc = y * Math.sin(incRad) + z * Math.cos(incRad);

        let xFinal = x * Math.cos(raanRad) - yInc * Math.sin(raanRad);
        let yFinal = x * Math.sin(raanRad) + yInc * Math.cos(raanRad);
        let zFinal = zInc;

        const lat = (Math.asin(zFinal / radius) * 180) / Math.PI;
        const lng = (Math.atan2(yFinal, xFinal) * 180) / Math.PI;

        return { ...sat, lat, lng };
      });

      setSatellitePositions(updatedSats);
      
      requestAnimationFrame(animateSatellites);
    };

    if (filteredSatellites.length > 0) {
      animateSatellites();
    }
  }, [filteredSatellites]);

  // Apply clouds when ThreeGlobe instance is available
  useEffect(() => {
    if (threeGlobe) {
      threeGlobe.cloudsTexture(CLOUDS_TEXTURE);
      threeGlobe.cloudsOpacity(0.6);
      threeGlobe.cloudsElevation(0.007);
    }
  }, [threeGlobe]);

  // Determine hex color based on point type
  const getHexTopColor = (d) => {
    const v = Math.min(1, d.sumWeight);
    
    // Check if this hex contains ocean points
    const hasOceanPoints = d.points && d.points.some(point => point.type === 'ocean');
    
    // Check if this hex contains satellite points
    const hasSatellitePoints = d.points && d.points.some(point => point.type === 'satellite');
    
    // Priority: if both types exist, show ocean (green)
    if (hasOceanPoints) {
      if (v > 0.8) return "rgba(50,255,50,0.95)";
      if (v > 0.6) return "rgba(50,255,50,0.95)";
      if (v > 0.4) return "rgba(50,255,50,0.95)";
      return "rgba(50,255,50,0.95)";
    }
    
    // Otherwise show satellite heatmap (red)
    if (hasSatellitePoints) {
      if (v > 0.8) return "rgba(255,50,50,0.95)";
      if (v > 0.6) return "rgba(255,50,50,0.95)";
      if (v > 0.4) return "rgba(255,50,50,0.95)";
      return "rgba(255,50,50,0.95)";
    }
    
    // Default (shouldn't happen)
    return "rgba(255,50,50,0.95)";
  };

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <Globe
        ref={globeRef}
        backgroundImageUrl={BACKGROUND_IMAGE}
        globeImageUrl={earthTexture}
        showAtmosphere={true}
        atmosphereColor={
          showOceanHeatmap ? "rgba(50, 255, 50, 0.3)" : // Green for ocean heatmap
          showHeatmap ? "rgba(255, 50, 50, 0.3)" : // Red for satellite heatmap
          "lightskyblue" // Default
        }
        atmosphereAltitude={0.14}
        // Satellites
        objectsData={satellitePositions}
        objectLat={(d) => d.lat}
        objectLng={(d) => d.lng}
        objectAltitude={(d) => d.altitude}
        objectThreeObject={(d) => {
          if (!satelliteModel || satelliteModel === "error") {
            return new THREE.Mesh(
              new THREE.SphereGeometry(0.02, 10, 10),
              new THREE.MeshPhongMaterial({ color: d.color })
            );
          }
          const model = satelliteModel.clone(true);
          return model;
        }}
        // Orbit paths
        pathsData={orbitPaths}
        pathPoints="points"
        pathPointLat={(p) => p.lat}
        pathPointLng={(p) => p.lng}
        pathPointAlt={(p) => p.alt}
        pathColor={(d) => d.color}
        pathStroke={0.6}
        pathDashAnimateTime={20000}
        pathTransitionDuration={0}
        // Combined heatmap data
        hexBinPointsData={allHeatmapPoints}
        hexBinPointWeight="weight"
        hexBinMerge={true}
        hexAltitude={() => 0.0005}
        hexBinResolution={3}
        hexRadius={3.5}
        hexTopColor={getHexTopColor}
        hexSideColor={() => "rgba(0,0,0,0)"}
        onGlobeReady={() => {
          if (globeRef.current && globeRef.current.__threeGlobe) {
            setThreeGlobe(globeRef.current.__threeGlobe);

            // Add lights
            const scene = globeRef.current.scene();
            const dirLight = new THREE.DirectionalLight(0xffffff, 2);
            dirLight.position.set(5, 5, 5);
            scene.add(dirLight);
            const ambLight = new THREE.AmbientLight(0xffffff, 0.6);
            scene.add(ambLight);
            
            // Remove any existing colored ambient lights
            scene.children.forEach(child => {
              if (child.isAmbientLight && 
                  (child.color.r !== 1 || child.color.g !== 1 || child.color.b !== 1)) {
                scene.remove(child);
              }
            });
            
            // Add colored ambient light based on heatmap type
            if (showHeatmap) {
              const heatmapLight = new THREE.AmbientLight(0xff3333, 0.3);
              scene.add(heatmapLight);
            } else if (showOceanHeatmap) {
              const oceanLight = new THREE.AmbientLight(0x33ff33, 0.3);
              scene.add(oceanLight);
            }
          }
        }}
        animateIn={false}
      />
    </div>
  );
};

export default EarthGlobe;