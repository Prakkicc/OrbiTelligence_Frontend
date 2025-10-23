// SatelliteGlobe.jsx (New Component)
import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import Globe from 'react-globe.gl';
import * as satellite from 'satellite.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';

const SatelliteGlobe = ({ satelliteData, onExit }) => {
  const globeRef = useRef();
  const [satelliteModel, setSatelliteModel] = useState(null);
  const [satellitePosition, setSatellitePosition] = useState({ lat: 0, lng: 0, alt: 0 });
  const requestRef = useRef();
  const previousTimeRef = useRef();
  const cameraPositionRef = useRef(new THREE.Vector3());
  const satellitePositionRef = useRef(new THREE.Vector3());

  // Earth textures
  const EARTH_TEXTURE = "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg";
  const CLOUDS_TEXTURE = "https://clouds.matteason.co.uk/images/8192x4096/clouds-alpha.png";
  const BACKGROUND_IMAGE = "https://unpkg.com/three-globe/example/img/night-sky.png";

  // Load satellite model
  useEffect(() => {
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
    loader.setDRACOLoader(dracoLoader);

    loader.load(
      '/models/tdrs.glb', 
      (gltf) => {
        gltf.scene.scale.set(0.3, 0.3, 0.3);
        setSatelliteModel(gltf.scene);
      },
      undefined,
      (error) => {
        console.error('Error loading GLB model:', error);
        // Fallback to a simple sphere if model fails to load
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.02, 10, 10),
          new THREE.MeshPhongMaterial({ color: '#00ffff' })
        );
        setSatelliteModel(sphere);
      }
    );
  }, []);

  // Convert latitude, longitude, altitude to Cartesian coordinates
  const latLngAltToCartesian = (lat, lng, alt) => {
    const phi = (90 - lat) * Math.PI / 180;
    const theta = (lng + 180) * Math.PI / 180;
    const radius = 1 + alt;
    
    return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
  };

  // Calculate satellite position from TLE data
  const calculateSatellitePosition = () => {
    if (!satelliteData || !satelliteData.tle1 || !satelliteData.tle2) return null;
    
    try {
      // Parse TLE
      const satrec = satellite.twoline2satrec(satelliteData.tle1, satelliteData.tle2);
      
      // Get current time
      const now = new Date();
      
      // Propagate satellite position
      const positionAndVelocity = satellite.propagate(satrec, now);
      
      if (!positionAndVelocity.position) return null;
      
      // Calculate Greenwich Mean Sidereal Time
      const gmst = satellite.gstime(now);
      
      // Convert to geodetic coordinates
      const positionGd = satellite.eciToGeodetic(positionAndVelocity.position, gmst);
      
      // Convert to degrees and normalized altitude
      const lat = satellite.degreesLat(positionGd.latitude);
      const lng = satellite.degreesLong(positionGd.longitude);
      const alt = positionGd.height / 6371; // Earth radius normalization
      
      return { lat, lng, alt };
    } catch (error) {
      console.error('Error calculating satellite position:', error);
      return null;
    }
  };

  // Animation loop for satellite movement and chase camera
  const animate = (time) => {
    if (!globeRef.current) return;
    
    // Calculate delta time for smooth animation
    if (previousTimeRef.current !== undefined) {
      const deltaTime = (time - previousTimeRef.current) / 1000;
      
      // Update satellite position
      const newPosition = calculateSatellitePosition();
      if (newPosition) {
        setSatellitePosition(newPosition);
        
        // Convert to Cartesian for camera calculations
        satellitePositionRef.current = latLngAltToCartesian(
          newPosition.lat, 
          newPosition.lng, 
          newPosition.alt
        );
        
        // Get camera and controls
        const camera = globeRef.current.camera();
        const controls = globeRef.current.controls();
        
        // Calculate future position for direction vector
        const futurePosition = calculateSatellitePosition(new Date(Date.now() + 50));
        if (futurePosition) {
          const futureCartesian = latLngAltToCartesian(
            futurePosition.lat, 
            futurePosition.lng, 
            futurePosition.alt
          );
          
          // Calculate direction vector
          const direction = new THREE.Vector3().subVectors(
            futureCartesian, 
            satellitePositionRef.current
          ).normalize();
          
          // Calculate ideal camera position (behind and above satellite)
          const chaseDistance = 0.3;
          const verticalOffset = 0.1;
          const idealCameraPosition = new THREE.Vector3()
            .copy(satellitePositionRef.current)
            .sub(direction.multiplyScalar(chaseDistance))
            .add(new THREE.Vector3(0, verticalOffset, 0));
          
          // Smoothly interpolate camera position
          cameraPositionRef.current.lerp(idealCameraPosition, 0.1);
          camera.position.copy(cameraPositionRef.current);
          
          // Make camera look at satellite
          camera.lookAt(satellitePositionRef.current);
          
          // Update controls
          controls.update();
        }
      }
    }
    
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  };

  // Start animation loop
  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [satelliteData]);

  // Add back button handler
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && onExit) {
        onExit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onExit]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <Globe
        ref={globeRef}
        backgroundImageUrl={BACKGROUND_IMAGE}
        globeImageUrl={EARTH_TEXTURE}
        showAtmosphere={true}
        atmosphereColor="lightskyblue"
        atmosphereAltitude={0.14}
        cloudsTexture={CLOUDS_TEXTURE}
        cloudsOpacity={0.6}
        cloudsElevation={0.007}
        onGlobeReady={() => {
          if (globeRef.current) {
            // Add lights
            const scene = globeRef.current.scene();
            const dirLight = new THREE.DirectionalLight(0xffffff, 2);
            dirLight.position.set(5, 5, 5);
            scene.add(dirLight);
            const ambLight = new THREE.AmbientLight(0xffffff, 0.6);
            scene.add(ambLight);
          }
        }}
        animateIn={false}
      />
      
      {/* Back button */}
      <button
        onClick={onExit}
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          zIndex: 1000,
          padding: '10px 15px',
          backgroundColor: 'rgba(0, 30, 60, 0.8)',
          color: '#00aaff',
          border: '1px solid #00aaff',
          borderRadius: '5px',
          cursor: 'pointer',
          fontFamily: 'Orbitron, sans-serif',
          fontSize: '14px',
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}
      >
        Back to Overview
      </button>
      
      {/* Satellite info display */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          zIndex: 1000,
          padding: '15px',
          backgroundColor: 'rgba(0, 30, 60, 0.8)',
          color: '#00ffff',
          border: '1px solid #00aaff',
          borderRadius: '5px',
          fontFamily: 'Orbitron, sans-serif',
          fontSize: '12px'
        }}
      >
        <h3 style={{ margin: '0 0 10px 0', textTransform: 'uppercase' }}>
          {satelliteData?.name || 'Satellite'}
        </h3>
        <p>Lat: {satellitePosition.lat.toFixed(2)}°</p>
        <p>Lng: {satellitePosition.lng.toFixed(2)}°</p>
        <p>Alt: {(satellitePosition.alt * 6371).toFixed(0)} km</p>
      </div>
    </div>
  );
};

export default SatelliteGlobe;