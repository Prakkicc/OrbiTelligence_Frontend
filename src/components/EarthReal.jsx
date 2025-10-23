// src/components/EarthReal.jsx
// Minimal, heatmap-free version with simulateMode support
// Updated to accept an external sim clock (simNowRefProp) and to derive rotations/propagation from it.
// Only timing-related changes were made; textures, lighting and shaders remain unchanged.

import React, { useRef, useEffect, useState, Suspense, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, useTexture, Text } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import * as satellite from "satellite.js";

import earthData from "../assets/EarthSample.json";
import sunData from "../assets/SunSample.json";
import moonData from "../assets/MoonSample.json";

import dayImg from "../assets/earth-blue-marble.jpg";
import nightImg from "../assets/8k_earth_nightmap.jpg";
import normalImg from "../assets/2k_earth_normal_map.jpg";
import specularImg from "../assets/2k_earth_specular_map.jpg";
import cloudsImg from "../assets/2k_earth_clouds.jpg";
import starsImg from "../assets/8k_stars_milky_way.jpg";
import sunImg from "../assets/2k_sun.jpg";
import moonImg from "../assets/2k_moon.jpg";
import satelliteGLB from "../assets/tdrs.glb";

const DEBUG = false;
// keep TIME_SCALE_FACTOR definition for backward compat if any other code expects it
const TIME_SCALE_FACTOR = 86164 / (8 * 60);
const ORBIT_UPDATE_INTERVAL = 2.0;
const ORBIT_SAMPLES = 120;
const SAT_SCALE = 0.0009;
const SUN_ORBIT_PERIOD_SEC = 24 * 3600;

const DIST_COMPRESSION_EXPONENT = 0.62;
const DISTANCE_MULTIPLIER = 1.0;
const MOON_MIN_EARTH_RADII = 2.5;

////////// helpers //////////
function computeLineDistancesManual(geometry) {
  try {
    const pos = geometry.getAttribute("position");
    if (!pos) return;
    const count = pos.count;
    const lineDistances = new Float32Array(count);
    let d = 0;
    lineDistances[0] = 0;
    for (let i = 1; i < count; i++) {
      const x1 = pos.getX(i - 1),
        y1 = pos.getY(i - 1),
        z1 = pos.getZ(i - 1);
      const x2 = pos.getX(i),
        y2 = pos.getY(i),
        z2 = pos.getZ(i);
      const dx = x2 - x1,
        dy = y2 - y1,
        dz = z2 - z1;
      d += Math.sqrt(dx * dx + dy * dy + dz * dz);
      lineDistances[i] = d;
    }
    geometry.setAttribute(
      "lineDistance",
      new THREE.BufferAttribute(lineDistances, 1)
    );
    geometry.computeBoundingSphere();
  } catch (e) {
    if (DEBUG) console.warn("computeLineDistancesManual failed", e);
  }
}

////////// OrbitTube //////////
function OrbitTube({
  positionsFloat32,
  color = "#00ffff",
  radius = 0.0013,
  radialSegments = 6,
  tubularSegments = null,
  opacity = 0.92,
  segmentsSimplify = 1,
  maxGap = 0.08,
  glRestoreTick = 0,
}) {
  const { size } = useThree();

  const alphaMap = useMemo(() => {
    const s = 64;
    const canvas = document.createElement("canvas");
    canvas.width = s;
    canvas.height = s;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.6, "rgba(255,255,255,0.45)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }, [glRestoreTick]);

  const points = useMemo(() => {
    if (!positionsFloat32 || positionsFloat32.length < 3) return [];
    const pts = [];
    const len = positionsFloat32.length / 3;
    const step = Math.max(1, Math.floor(segmentsSimplify));
    for (let i = 0; i < len; i += step) {
      const x = positionsFloat32[i * 3];
      const y = positionsFloat32[i * 3 + 1];
      const z = positionsFloat32[i * 3 + 2];
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        pts.push(new THREE.Vector3(x, y, z));
      }
    }
    return pts;
  }, [positionsFloat32, segmentsSimplify, glRestoreTick]);

  const segments = useMemo(() => {
    if (points.length < 2) return [];
    const segs = [];
    let cur = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const d = points[i].distanceTo(points[i - 1]);
      if (d > maxGap) {
        if (cur.length >= 2) segs.push(cur);
        cur = [points[i]];
      } else {
        cur.push(points[i]);
      }
    }
    if (cur.length >= 2) segs.push(cur);
    return segs;
  }, [points, maxGap, glRestoreTick]);

  const meshes = useMemo(() => {
    if (!segments || segments.length === 0) return null;
    return segments.map((seg) => {
      if (seg.length < 3) {
        const curve = new THREE.CatmullRomCurve3(
          seg,
          false,
          "centripetal",
          0.0
        );
        const tubularCount = tubularSegments || Math.max(4, seg.length * 6);
        const tubeGeom = new THREE.TubeGeometry(
          curve,
          tubularCount,
          radius,
          radialSegments,
          false
        );
        computeLineDistancesManual(tubeGeom);
        return tubeGeom;
      } else {
        const curve = new THREE.CatmullRomCurve3(
          seg,
          false,
          "centripetal",
          0.0
        );
        const tubularCount =
          tubularSegments || Math.max(8, Math.floor(seg.length * 3));
        const tubeGeom = new THREE.TubeGeometry(
          curve,
          tubularCount,
          radius,
          radialSegments,
          false
        );
        computeLineDistancesManual(tubeGeom);
        return tubeGeom;
      }
    });
  }, [segments, radius, radialSegments, tubularSegments, glRestoreTick]);

  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color,
        emissive: new THREE.Color(color),
        emissiveIntensity: 1.08,
        metalness: 0.0,
        roughness: 0.7,
        transparent: true,
        opacity,
        depthWrite: false,
        alphaMap,
        side: THREE.DoubleSide,
      }),
    [color, opacity, alphaMap, glRestoreTick]
  );

  useFrame((state) => {
    if (!mat) return;
    const t = state.clock.elapsedTime;
    mat.emissiveIntensity = 0.95 + Math.sin(t * 0.9) * 0.08;
  });

  if (!meshes || meshes.length === 0) return null;
  return (
    <>
      {meshes.map((g, i) => (
        <mesh key={`tube-${i}`} geometry={g} material={mat} />
      ))}
    </>
  );
}

function latLngAltFractionToVec3(latDeg, lonDeg, altFraction = 0) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg);
  const r = 1 + (altFraction || 0);
  return new THREE.Vector3(
    r * Math.cos(lat) * Math.cos(lon),
    r * Math.sin(lat),
    r * Math.cos(lat) * Math.sin(lon)
  );
}

function propagateTLE_toFractionAlt(satrec, baseTime = new Date()) {
  try {
    const pv = satellite.propagate(satrec, baseTime);
    if (!pv || !pv.position) return null;
    const gmst = satellite.gstime(baseTime);
    const geo = satellite.eciToGeodetic(pv.position, gmst);
    return {
      lat: satellite.degreesLat(geo.latitude),
      lng: satellite.degreesLong(geo.longitude),
      altFraction: geo.height / (earthData.earth.radius_km || 6371),
    };
  } catch (e) {
    return null;
  }
}

function generateOrbitPathFromTLE(
  satrec,
  samples = ORBIT_SAMPLES,
  stepSec = 30,
  centerTime = new Date()
) {
  const out = [];
  const half = Math.floor(samples / 2);
  for (let i = -half; i <= half; i++) {
    const t = new Date(centerTime.getTime() + i * stepSec * 1000);
    try {
      const pv = satellite.propagate(satrec, t);
      if (!pv || !pv.position) {
        out.push(null);
        continue;
      }
      const gmst = satellite.gstime(t);
      const geo = satellite.eciToGeodetic(pv.position, gmst);
      out.push({
        lat: satellite.degreesLat(geo.latitude),
        lng: satellite.degreesLong(geo.longitude),
        altFraction: geo.height / (earthData.earth.radius_km || 6371),
      });
    } catch (err) {
      out.push(null);
    }
  }
  return out.filter(Boolean);
}

function cloneGltfSceneWithClonedMaterials(scene) {
  if (!scene) return null;
  const cloned = scene.clone(true);
  cloned.traverse((node) => {
    if (node.isMesh && node.material) {
      if (Array.isArray(node.material)) {
        node.material = node.material.map((m) => (m ? m.clone() : m));
      } else {
        node.material = node.material.clone();
      }
    }
  });
  return cloned;
}

function compressDistanceKmToEarthRadii(distance_km) {
  const earthRadiusKm = earthData.earth.radius_km || 6371;
  const ratio = distance_km / earthRadiusKm;
  const scaled =
    Math.pow(ratio, DIST_COMPRESSION_EXPONENT) * DISTANCE_MULTIPLIER;
  return scaled;
}

////////// shaders & visuals (unchanged day/night shader & atmosphere) //////////
function AtmosphereGlow({
  intensity = 0.9,
  color = new THREE.Color(0x2a7fff),
}) {
  const matRef = useRef();
  const { camera } = useThree();

  const uniforms = useMemo(
    () => ({
      viewVector: { value: new THREE.Vector3(0, 0, 1) },
      coeficient: { value: intensity },
      power: { value: 3.2 },
      glowColor: { value: color },
    }),
    [intensity, color]
  );

  useFrame(() => {
    const viewVec = new THREE.Vector3()
      .subVectors(camera.position, new THREE.Vector3())
      .normalize();
    if (
      matRef.current &&
      matRef.current.uniforms &&
      matRef.current.uniforms.viewVector
    ) {
      matRef.current.uniforms.viewVector.value.copy(viewVec);
    }
  });

  return (
    <mesh>
      <sphereGeometry args={[1.02, 64, 64]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vNormal;
          void main(){
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
          }`}
        fragmentShader={`
          uniform vec3 viewVector;
          uniform float coeficient;
          uniform float power;
          uniform vec3 glowColor;
          varying vec3 vNormal;
          void main(){
            float i = pow(coeficient - dot(vNormal, normalize(viewVector)), power);
            gl_FragColor = vec4(glowColor,1.0)*i;
          }`}
        blending={THREE.AdditiveBlending}
        side={THREE.BackSide}
        transparent
        depthWrite={false}
        lights={false}
        fog={false}
      />
    </mesh>
  );
}

function EarthDayNightMaterial({ dayMap, nightMap }) {
  const matRef = useRef();
  const { scene, camera } = useThree();

  const uniforms = useMemo(
    () => ({
      dayTexture: { value: dayMap || null },
      nightTexture: { value: nightMap || null },
      sunDirection: { value: new THREE.Vector3(1, 0, 0) },
      cameraPos: { value: new THREE.Vector3() },
    }),
    [dayMap, nightMap]
  );

  useFrame(() => {
    const sunLight = scene.getObjectByName("sunLight");
    if (
      sunLight &&
      matRef.current &&
      matRef.current.uniforms &&
      matRef.current.uniforms.sunDirection
    ) {
      const sunPos = new THREE.Vector3();
      sunLight.getWorldPosition(sunPos);
      matRef.current.uniforms.sunDirection.value.copy(sunPos).normalize();
    }

    if (
      camera &&
      matRef.current &&
      matRef.current.uniforms &&
      camera.position
    ) {
      matRef.current.uniforms.cameraPos.value.copy(camera.position);
    }
  });

  return (
    <shaderMaterial
      ref={matRef}
      uniforms={uniforms}
      vertexShader={`
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }`}
      fragmentShader={`
        uniform sampler2D dayTexture;
        uniform sampler2D nightTexture;
        uniform vec3 sunDirection;
        uniform vec3 cameraPos;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPos;

        // simple Fresnel approximation
        float fresnel(float f0, float power, vec3 viewDir, vec3 normal) {
          float fv = 1.0 - max(dot(viewDir, normal), 0.0);
          return f0 + (1.0 - f0) * pow(fv, power);
        }

        void main() {
          vec3 normal = normalize(vNormal);
          vec3 sunDir = normalize(sunDirection);

          // dot for day/night mix
          float dotNL = dot(normal, sunDir);

          float mixAmount = smoothstep(-0.15, 0.35, dotNL);

          vec3 dayColor = texture2D(dayTexture, vUv).rgb;
          vec3 nightColor = texture2D(nightTexture, vUv).rgb;

          // boost day & darken night a bit to increase contrast
          dayColor *= 1.35;
          nightColor *= 0.55;

          // atmospheric scattering tint near limb (blue-ish)
          vec3 atmosphere = vec3(0.2, 0.35, 0.7) * pow(max(dotNL, 0.0), 3.0) * 0.8;

          // soft edge glow at terminator
          float edgeGlow = smoothstep(0.0, 0.3, abs(dotNL));
          vec3 glowColor = vec3(0.05, 0.15, 0.3) * (1.0 - edgeGlow);

          // Specular / Sun reflection: a subtle specular highlight that follows sunDir
          vec3 viewDir = normalize(cameraPos - vWorldPos);
          vec3 H = normalize(viewDir + sunDir);
          float specAngle = max(dot(normal, H), 0.0);
          float shininess = 40.0;
          float rim = fresnel(0.02, 5.0, viewDir, normal);
          float specularStrength = smoothstep(0.0, 0.9, dotNL) * 0.9;
          vec3 specular = vec3(1.0) * pow(specAngle, shininess) * specularStrength * 0.75 * rim;

          vec3 color = mix(nightColor + glowColor, dayColor + atmosphere, mixAmount);
          color += specular;

          color = color / (color + vec3(1.0));
          color = pow(color, vec3(0.95)); // gentle gamma

          gl_FragColor = vec4(color, 1.0);
        }`}
      lights={false}
      fog={false}
    />
  );
}

////////// Sun & Moon //////////
function Sun({ simNowRef }) {
  const meshGroupRef = useRef();
  const dirLightRef = useRef();
  const { scene } = useThree();

  const distanceEarthRadii = compressDistanceKmToEarthRadii(
    sunData.sun.average_distance_from_earth_km || 149597870
  );

  useFrame(() => {
    if (!simNowRef || !simNowRef.current) return;
    const simSec = simNowRef.current.getTime() / 1000;
    const angle =
      ((simSec % SUN_ORBIT_PERIOD_SEC) / SUN_ORBIT_PERIOD_SEC) * Math.PI * 2;
    const x = Math.cos(angle) * distanceEarthRadii;
    const z = Math.sin(angle) * distanceEarthRadii;
    const y = 0;

    if (meshGroupRef.current) meshGroupRef.current.position.set(x, y, z);
    if (dirLightRef.current) {
      dirLightRef.current.position.set(x, y, z);
      if (!dirLightRef.current.target) {
        dirLightRef.current.target = new THREE.Object3D();
        scene.add(dirLightRef.current.target);
      }
      dirLightRef.current.target.position.set(0, 0, 0);
      dirLightRef.current.target.updateMatrixWorld();
    }
  });

  const glowUniforms = useMemo(
    () => ({
      glowColor: { value: new THREE.Color(0xfff6a0) },
      coreColor: { value: new THREE.Color(0xffffff) },
    }),
    []
  );

  return (
    <>
      <group ref={meshGroupRef}>
        <mesh>
          <sphereGeometry args={[10, 128, 128]} />
          <meshStandardMaterial
            color={"#fff6a0"}
            emissive={"#fff6a0"}
            emissiveIntensity={12}
            roughness={1}
            metalness={0}
            toneMapped={false}
          />
        </mesh>

        <mesh>
          <sphereGeometry args={[50, 64, 64]} />
          <shaderMaterial
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            uniforms={glowUniforms}
            vertexShader={`varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`}
            fragmentShader={`uniform vec3 glowColor; uniform vec3 coreColor; varying vec3 vPos; void main(){ float dist = length(vPos)/50.0; float alpha = smoothstep(1.0,0.0,dist); vec3 color = mix(coreColor, glowColor, dist); gl_FragColor = vec4(color, alpha*0.5); }`}
          />
        </mesh>
      </group>

      <directionalLight
        ref={dirLightRef}
        name="sunLight"
        intensity={7}
        color={"#fff5b0"}
      />
    </>
  );
}

function Moon({ simNowRef }) {
  const texture = useTexture(moonImg);
  const moonRef = useRef();

  let moonDist = compressDistanceKmToEarthRadii(
    moonData.moon.average_distance_from_earth_km || 384400
  );
  moonDist = Math.max(moonDist, MOON_MIN_EARTH_RADII);

  const moonScale =
    (moonData.moon.radius_km || 1737.4) / (earthData.earth.radius_km || 6371);
  const inclination = THREE.MathUtils.degToRad(
    moonData.moon.inclination_deg || 5.145
  );

  useFrame(() => {
    // use simNowRef so moon follows timeline
    const tSec =
      simNowRef && simNowRef.current
        ? simNowRef.current.getTime() / 1000
        : Date.now() / 1000;
    const angle = (tSec / 60) % (Math.PI * 2);
    const x = Math.cos(angle) * moonDist;
    const z = Math.sin(angle) * moonDist;
    const y = Math.sin(inclination) * z;
    if (moonRef.current) moonRef.current.position.set(x, y, z);
  });

  return (
    <mesh ref={moonRef}>
      <sphereGeometry args={[moonScale * 0.8, 64, 64]} />
      <meshPhongMaterial map={texture} shininess={5} color={"#cccccc"} />
    </mesh>
  );
}

////////// Satellite renderer //////////
function SatelliteObject({
  position = [0, 0, 0],
  color,
  name,
  glRestoreTick = 0,
  isHovered = false,
}) {
  const circleTexture = useMemo(() => {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "white";
    ctx.stroke();
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }, [glRestoreTick]);

  const spriteScale = 0.03;
  // FIX: invalid 8-digit hex removed — use 6-digit hex for THREE.Color compatibility
  const labelColor = isHovered ? "#ffffff" : "#a5a4a4";
  const labelSize = isHovered ? 0.036 : 0.035;

  return (
    <group>
      <sprite position={position} scale={[spriteScale, spriteScale, 1]}>
        <spriteMaterial
          map={circleTexture}
          transparent
          depthWrite={false}
          depthTest={true}
          opacity={1}
        />
      </sprite>

      {name && (
        <Text
          position={[position[0], position[1] + 0.05, position[2]]}
          fontSize={labelSize}
          color={labelColor}
          anchorX="center"
          anchorY="bottom"
          depthWrite={false}
          renderOrder={10}
          outlineWidth={0.002}
          outlineColor="#000000"
        >
          {name}
        </Text>
      )}
    </group>
  );
}

////////// EarthScene (main) //////////
function EarthScene({
  satelliteData = [],
  simulateMode = false,
  simulateTargetName = null,
  simNowRefProp = null,
}) {
  const groupRef = useRef();
  const spaceRef = useRef();
  const cloudsRef = useRef();
  const cloudMatRef = useRef();
  const gltf = useGLTF(satelliteGLB);
  const { scene, camera } = useThree();

  const [dayMap, nightMap, normalMap, specMap, cloudMap, starsMap] = useTexture(
    [dayImg, nightImg, normalImg, specularImg, cloudsImg, starsImg]
  );

  useEffect(() => {
    [dayMap, nightMap, cloudMap, starsMap].forEach((t) => {
      if (t) t.encoding = THREE.sRGBEncoding;
    });
  }, [scene, starsMap, dayMap, nightMap, cloudMap]);

  useEffect(() => {
    if (gltf?.scene) {
      gltf.scene.scale.set(0.002, 0.002, 0.002);
    }
  }, [gltf]);

  // --- ADDED: glRestoreTick state + listeners to handle WebGL context restore ---
  const [glRestoreTick, setGlRestoreTick] = useState(0);

  useEffect(() => {
    const canvas =
      typeof document !== "undefined" ? document.querySelector("canvas") : null;
    if (!canvas) return;

    const onContextLost = (e) => {
      try {
        e.preventDefault();
      } catch (err) {}
      if (DEBUG) console.warn("WebGL context lost");
    };

    const onContextRestored = () => {
      if (DEBUG)
        console.info("WebGL context restored, forcing resource reuploads");
      try {
        if (scene && scene.traverse) {
          scene.traverse((obj) => {
            if (obj.isMesh) {
              if (obj.material) {
                if (Array.isArray(obj.material)) {
                  obj.material.forEach((m) => {
                    if (m) m.needsUpdate = true;
                    if (m && m.map)
                      try {
                        m.map.needsUpdate = true;
                      } catch (e) {}
                  });
                } else {
                  obj.material.needsUpdate = true;
                  if (obj.material.map)
                    try {
                      obj.material.map.needsUpdate = true;
                    } catch (e) {}
                }
              }
              if (obj.geometry) {
                try {
                  const posAttr =
                    obj.geometry.getAttribute &&
                    obj.geometry.getAttribute("position");
                  if (posAttr) posAttr.needsUpdate = true;
                  obj.geometry.computeBoundingSphere();
                } catch (e) {}
              }
            }
            if (obj.isSprite && obj.material && obj.material.map) {
              try {
                obj.material.map.needsUpdate = true;
              } catch (e) {}
            }
          });
        }
      } catch (e) {
        if (DEBUG) console.warn("Error traversing scene on restore", e);
      }
      setGlRestoreTick((t) => t + 1);
    };

    canvas.addEventListener("webglcontextlost", onContextLost, false);
    canvas.addEventListener("webglcontextrestored", onContextRestored, false);

    return () => {
      canvas.removeEventListener("webglcontextlost", onContextLost, false);
      canvas.removeEventListener(
        "webglcontextrestored",
        onContextRestored,
        false
      );
    };
  }, [scene]);

  const axialTiltDeg = earthData?.earth?.axial_tilt_deg ?? 23.439281;
  const cloudRadiusMult =
    earthData?.earth?.clouds_config?.radius_multiplier ?? 1.02;

  const [satRecs, setSatRecs] = useState([]);
  const [orbitPaths, setOrbitPaths] = useState([]);
  const [satPositions, setSatPositions] = useState([]);

  // prefer external simNowRefProp (owned by App) if provided; otherwise use local fallback
  const localSimRef = useRef(new Date());
  const simNowRef = simNowRefProp || localSimRef;

  // lastSimNowMsRef used to compute signed dtSimSec (so scrubs/backwards moves handled)
  const lastSimNowMsRef = useRef(
    simNowRef.current ? simNowRef.current.getTime() : Date.now()
  );

  const rafRef = useRef(null);
  const initialCamQuatRef = useRef(null);

  // label hover / selection
  const [hoveredSat, setHoveredSat] = useState(null);
  const [selectedSat, setSelectedSat] = useState(null);
  const chaseRef = useRef({
    active: false,
    t: 0,
    duration: 2.5,
    startPos: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    target: new THREE.Vector3(),
  });

  useEffect(() => {
    if (!Array.isArray(satelliteData) || satelliteData.length === 0) {
      setSatRecs([]);
      setOrbitPaths([]);
      setSatPositions([]);
      return;
    }

    const selected = satelliteData.slice(0, 15).map((s) => {
      if (!s._orbitColor)
        s._orbitColor = Math.random() < 0.5 ? "#00ffff" : "#ffa500";
      return s;
    });

    const parsed = selected
      .map((s) => {
        try {
          let lines = null;
          if (Array.isArray(s.tle) && s.tle.length >= 2)
            lines = [s.tle[0], s.tle[1]];
          else if (typeof s.tle === "string" && s.tle.includes("\n")) {
            const p = s.tle
              .split("\n")
              .map((x) => x.trim())
              .filter(Boolean);
            if (p.length >= 2) lines = [p[0], p[1]];
          } else {
            const l1 = s.line1 ?? s.Line1 ?? s["line_1"];
            const l2 = s.line2 ?? s.Line2 ?? s["line_2"];
            if (l1 && l2) lines = [String(l1).trim(), String(l2).trim()];
          }
          if (!lines) return null;
          const satrec = satellite.twoline2satrec(lines[0], lines[1]);
          return {
            raw: s,
            satrec,
            tle: lines,
            color: s._orbitColor || "#00ffff",
          };
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean);

    // use simNowRef.current as center for orbit generation so timeline scrubs update paths
    const now = simNowRef.current || new Date();
    const paths = parsed.map((p) => {
      const samples = generateOrbitPathFromTLE(
        p.satrec,
        ORBIT_SAMPLES,
        30,
        now
      );
      const arr = new Float32Array(samples.length * 3);
      for (let i = 0; i < samples.length; i++) {
        const v = latLngAltFractionToVec3(
          samples[i].lat,
          samples[i].lng,
          samples[i].altFraction
        );
        arr[i * 3] = v.x;
        arr[i * 3 + 1] = v.y;
        arr[i * 3 + 2] = v.z;
      }
      return { positions: arr, color: p.color, name: p.raw?.name ?? null };
    });

    setSatRecs(parsed);
    setOrbitPaths(paths);
    setSatPositions([]);
  }, [satelliteData, simNowRef]); // regenerate if simNowRef changes (scrub or day change)

  // RAF loop / updater for satellites & orbit regeneration
  useEffect(() => {
    if (!satRecs || satRecs.length === 0) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    let mounted = true;
    let lastPerf = performance.now();
    let orbitAcc = 0;

    // initialize lastSimNowMsRef from current simNowRef
    lastSimNowMsRef.current = simNowRef.current
      ? simNowRef.current.getTime()
      : Date.now();

    const loop = () => {
      if (!mounted) return;
      const nowPerf = performance.now();
      const frameMs = nowPerf - lastPerf;
      lastPerf = nowPerf;

      // IMPORTANT: do NOT advance simNowRef here if App owns the clock.
      // Instead compute signed dtSimSec from difference between current simNowRef and last known sim time.
      const currentSimMs = simNowRef.current
        ? simNowRef.current.getTime()
        : Date.now();
      const signedDtSimSec =
        (currentSimMs - (lastSimNowMsRef.current || currentSimMs)) / 1000;
      lastSimNowMsRef.current = currentSimMs;

      // update satellite positions using authoritative simNowRef
      const updated = satRecs.map((r) => {
        const pos = propagateTLE_toFractionAlt(r.satrec, simNowRef.current);
        if (!pos)
          return {
            raw: r.raw,
            lat: undefined,
            lng: undefined,
            altFraction: undefined,
            color: r.color,
            satrec: r.satrec,
          };
        return {
          raw: r.raw,
          lat: pos.lat,
          lng: pos.lng,
          altFraction: pos.altFraction,
          color: r.color,
          satrec: r.satrec,
        };
      });
      if (mounted) setSatPositions(updated);

      // orbit accumulator: use absolute dt so fast scrubs still trigger update quickly
      orbitAcc += Math.abs(signedDtSimSec);
      if (orbitAcc >= ORBIT_UPDATE_INTERVAL) {
        orbitAcc = 0;
        const newPaths = satRecs.map((r) => {
          const samples = generateOrbitPathFromTLE(
            r.satrec,
            ORBIT_SAMPLES,
            30,
            simNowRef.current
          );
          const arr = new Float32Array(samples.length * 3);
          for (let i = 0; i < samples.length; i++) {
            const v = latLngAltFractionToVec3(
              samples[i].lat,
              samples[i].lng,
              samples[i].altFraction
            );
            arr[i * 3] = v.x;
            arr[i * 3 + 1] = v.y;
            arr[i * 3 + 2] = v.z;
          }
          return { positions: arr, color: r.color, name: r.raw?.name ?? null };
        });
        if (mounted) setOrbitPaths(newPaths);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [satRecs, simNowRef]);

  useFrame((state, delta) => {
    // Earth rotation: compute rotation delta from simNowRef absolute time (so scrubbing reflects instantly)
    const rotationRateDegPerSec =
      earthData.earth?.rotation_rate_deg_per_sec ?? 360 / (8 * 60);
    const simSec = simNowRef.current ? simNowRef.current.getTime() / 1000 : 0;

    if (!groupRef.current.userData._lastSimSec)
      groupRef.current.userData._lastSimSec = simSec;
    const lastSimSec = groupRef.current.userData._lastSimSec;
    const dSim = simSec - lastSimSec;
    const dRot = THREE.MathUtils.degToRad(rotationRateDegPerSec * dSim || 0);

    if (groupRef.current) groupRef.current.rotation.y += dRot;
    if (cloudsRef.current)
      cloudsRef.current.rotation.y +=
        dRot * (earthData.earth?.clouds_config?.rotation_multiplier ?? 1.1);
    groupRef.current.userData._lastSimSec = simSec;

    if (!initialCamQuatRef.current && camera && camera.quaternion) {
      initialCamQuatRef.current = camera.quaternion.clone();
      if (spaceRef.current) {
        spaceRef.current.matrixAutoUpdate = true;
        spaceRef.current.position.set(0, 0, 0);
      }
      return;
    }

    if (initialCamQuatRef.current && camera && spaceRef.current) {
      const qCamInv = camera.quaternion.clone().invert();
      const q = initialCamQuatRef.current.clone().multiply(qCamInv);
      spaceRef.current.quaternion.copy(q);
      spaceRef.current.position.set(0, 0, 0);
    }

    // chase camera animation
    
  });

  // when selectedSat changes, prepare chaseRef
  

  // --- helper: build corrected path by radial offset of original points ---
  const buildCorrectedPath = (origFloat32, offsetMultiplier = 0.02) => {
    if (!origFloat32 || origFloat32.length === 0) return null;
    const out = new Float32Array(origFloat32.length);
    for (let i = 0; i < origFloat32.length; i += 3) {
      const vx = origFloat32[i],
        vy = origFloat32[i + 1],
        vz = origFloat32[i + 2];
      const v = new THREE.Vector3(vx, vy, vz);
      const normal = v.clone().normalize();
      const mod = 1 + Math.sin(i / 9.0) * 0.02;
      const pushed = v.clone().multiplyScalar(1 + offsetMultiplier * mod);
      out[i] = pushed.x;
      out[i + 1] = pushed.y;
      out[i + 2] = pushed.z;
    }
    return out;
  };

  const findOrbitByName = (name) => {
    if (!name) return null;
    const found = orbitPaths.find(
      (o) => (o.name ?? "").toLowerCase() === name.toLowerCase()
    );
    return found || null;
  };

  const findCurrentLiveVec = (name) => {
    const s = satPositions.find(
      (p) => (p.raw?.name ?? "").toLowerCase() === (name ?? "").toLowerCase()
    );
    if (!s || s.lat === undefined) return null;
    return latLngAltFractionToVec3(s.lat, s.lng, s.altFraction);
  };

  return (
    <>
      <group ref={spaceRef}>
        {starsMap && (
          <mesh
            frustumCulled={false}
            scale={[900, 900, 900]}
            renderOrder={-100}
          >
            <sphereGeometry args={[1, 64, 64]} />
            <meshBasicMaterial
              map={starsMap}
              side={THREE.BackSide}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        )}

        {/* pass simNowRef so Sun/Moon follow timeline */}
        <Sun simNowRef={simNowRef} />
        <Moon simNowRef={simNowRef} />
      </group>

      <group
        ref={groupRef}
        rotation={[0, 0, THREE.MathUtils.degToRad(axialTiltDeg)]}
      >
        <mesh name="Earth">
          <sphereGeometry args={[1, 128, 128]} />
          <EarthDayNightMaterial dayMap={dayMap} nightMap={nightMap} />
        </mesh>

        <AtmosphereGlow intensity={0.9} color={new THREE.Color(0x2a7fff)} />

        <mesh ref={cloudsRef} name="Clouds">
          <sphereGeometry args={[1 * cloudRadiusMult, 64, 64]} />
          <meshLambertMaterial
            ref={cloudMatRef}
            map={cloudMap}
            alphaMap={cloudMap}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            opacity={0.92}
            color={"#ffffff"}
          />
        </mesh>

        {/* original orbit paths (muted) */}
        {orbitPaths.map((o, idx) => {
          return (
            <OrbitTube
              key={`orbit-${idx}`}
              positionsFloat32={o.positions}
              // muted/less prominent actual orbit
              color={o.color || "#00aaff"}
              radius={0.0018} // slightly thinner than corrected
              radialSegments={6}
              tubularSegments={Math.max(32, (o.positions.length / 3) >> 0)}
              opacity={0.16} // more transparent so corrected stands out
              segmentsSimplify={2}
              glRestoreTick={glRestoreTick}
            />
          );
        })}

        {/* satellite sprites (live) */}
        <group>
          {satPositions.map((s, i) => {
            if (s.lat === undefined || s.lng === undefined) return null;
            const v = latLngAltFractionToVec3(s.lat, s.lng, s.altFraction);
            const satName = s.raw?.name || `Sat-${i + 1}`;
            const isHovered = hoveredSat === satName;

            return (
              <group
                key={`sat-${i}`}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  setHoveredSat(satName);
                }}
                onPointerOut={(e) => {
                  e.stopPropagation();
                  setHoveredSat(null);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSat({
                    name: satName,
                    position: [v.x, v.y, v.z],
                    satrec: s.satrec ?? null,
                    raw: s.raw ?? null,
                  });
                }}
              >
                <SatelliteObject
                  position={[v.x, v.y, v.z]}
                  color={s.color}
                  model={gltf?.scene}
                  name={satName}
                  glRestoreTick={glRestoreTick}
                  isHovered={isHovered}
                />
              </group>
            );
          })}
        </group>

        {/* --- SIMULATION: corrected orbit + error line for simulateTargetName --- */}
        {simulateMode &&
          simulateTargetName &&
          (() => {
            const targetOrbit =
              findOrbitByName(simulateTargetName) || orbitPaths[0];
            if (!targetOrbit) return null;
            const corrected = buildCorrectedPath(targetOrbit.positions, 0.02);
            const currentVec = findCurrentLiveVec(simulateTargetName);
            let correctedCurrent = null;
            if (currentVec) {
              correctedCurrent = currentVec.clone().multiplyScalar(1 + 0.02);
            } else {
              const len = corrected ? corrected.length / 3 : 0;
              if (len > 0) {
                const mid = Math.floor(len / 2);
                correctedCurrent = new THREE.Vector3(
                  corrected[mid * 3],
                  corrected[mid * 3 + 1],
                  corrected[mid * 3 + 2]
                );
              }
            }

            return (
              <group key={`simulate-${simulateTargetName}`}>
                {corrected ? (
                  <OrbitTube
                    positionsFloat32={corrected}
                    color={"#00ff00"} // bright green
                    radius={0.0035} // thicker so it stands out
                    radialSegments={8}
                    tubularSegments={Math.max(12, (corrected.length / 3) >> 0)}
                    opacity={0.98} // solid and visible
                    segmentsSimplify={1}
                    glRestoreTick={glRestoreTick}
                  />
                ) : null}

                {correctedCurrent ? (
                  <group>
                    <SatelliteObject
                      position={[
                        correctedCurrent.x,
                        correctedCurrent.y,
                        correctedCurrent.z,
                      ]}
                      color={"#00ff00"}
                      name={`${simulateTargetName} (corrected)`}
                      glRestoreTick={glRestoreTick}
                      isHovered={false}
                    />
                  </group>
                ) : null}

                {currentVec && correctedCurrent ? (
                  <line>
                    <bufferGeometry attach="geometry">
                      <bufferAttribute
                        attachObject={["attributes", "position"]}
                        array={
                          new Float32Array([
                            currentVec.x,
                            currentVec.y,
                            currentVec.z,
                            correctedCurrent.x,
                            correctedCurrent.y,
                            correctedCurrent.z,
                          ])
                        }
                        count={2}
                        itemSize={3}
                      />
                    </bufferGeometry>
                    <lineBasicMaterial
                      attach="material"
                      color={"#ff3333"}
                      linewidth={3}
                    />
                  </line>
                ) : null}
              </group>
            );
          })()}
      </group>
    </>
  );
}

export default function EarthReal({
  satelliteData = [],
  simulateMode = false,
  simulateTargetName = null,
  simNowRefProp = null,
}) {
  useEffect(() => {
    if (!DEBUG) return;
    const handler = (e) => {
      console.error("[GLOBAL ERROR]", e);
    };
    window.addEventListener("error", handler);
    return () => window.removeEventListener("error", handler);
  }, []);

  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <Canvas
        camera={{ position: [0, 0, 8], fov: 45 }}
        gl={{ antialias: true }}
      >
        <ambientLight intensity={1.3} />
        <hemisphereLight
          skyColor={0xffffff}
          groundColor={0x444444}
          intensity={1.2}
        />
        <pointLight intensity={0.4} position={[0, -5, 0]} />

        <Suspense fallback={null}>
          {/* pass the simNowRefProp into EarthScene so timeline controls everything */}
          <EarthScene
            satelliteData={satelliteData}
            simulateMode={simulateMode}
            simulateTargetName={simulateTargetName}
            simNowRefProp={simNowRefProp}
          />
        </Suspense>

        <OrbitControls enablePan enableZoom enableRotate />

        <EffectComposer multisampling={0}>
          <Bloom
            intensity={1}
            luminanceThreshold={0.15}
            luminanceSmoothing={0.7}
            height={300}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
