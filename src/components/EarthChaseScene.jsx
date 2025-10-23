// EarthChaseScene.jsx
// Patched: camera hemisphere clamp so Earth is always below satellite,
// and more robust day/night sunDirection handling.

import React, { useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import * as satellite from "satellite.js";

import earthData from "../assets/EarthSample.json";
import sunData from "../assets/SunSample.json";
import moonData from "../assets/MoonSample.json";

import dayImg from "../assets/earth-blue-marble.jpg";
import nightImg from "../assets/8k_earth_nightmap.jpg";
import cloudsImg from "../assets/8k_earth_clouds.jpg";
import starsImg from "../assets/8k_stars_milky_way.jpg";
import sunImg from "../assets/2k_sun.jpg";
import moonImg from "../assets/2k_moon.jpg";
import satelliteGLB from "../assets/tdrs.glb";

// keep these consistent with EarthReal
const TIME_SCALE_FACTOR = 86164 / (128 * 60); // 32 minutes per rotation requested earlier
const SUN_ORBIT_PERIOD_SEC = 24 * 3600;
const DIST_COMPRESSION_EXPONENT = 0.6;
const DISTANCE_MULTIPLIER = 1.0;
const MOON_MIN_EARTH_RADII = 2.5;

const EARTH_RADIUS_LARGE = 200;
const MAX_ZOOM_OUT_RATIO = 1.9;

// Minimum radial (outward) component we require for the vector from satellite -> camera.
// This ensures camera stays on the "outside" hemisphere and the Earth remains visually below.
const MIN_RADIAL_COMPONENT = 0.18;

// ------------------ helpers ------------------
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

function compressDistanceKmToEarthRadii(distance_km) {
  const earthRadiusKm = earthData.earth.radius_km || 6371;
  const ratio = distance_km / earthRadiusKm;
  return Math.pow(ratio, DIST_COMPRESSION_EXPONENT) * DISTANCE_MULTIPLIER;
}

// ---------------- Visual utilities ----------------
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
            gl_FragColor = vec4(glowColor,1.0) * (i * 0.6);
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

// Use same EarthDayNightMaterial pattern but add a couple of guards + a tiny heuristic
// to avoid producing full-night (when sun direction is temporarily invalid or flipped).
function EarthDayNightMaterial({ dayMap, nightMap }) {
  const matRef = useRef();
  const { scene } = useThree();

  const uniforms = useMemo(
    () => ({
      dayTexture: { value: dayMap || null },
      nightTexture: { value: nightMap || null },
      sunDirection: { value: new THREE.Vector3(1, 0, 0) },
    }),
    [dayMap, nightMap]
  );

  useFrame(() => {
    // Keep the material's sunDirection updated from the directional light named "sunLight".
    const sun = scene.getObjectByName("sunLight");
    if (
      sun &&
      matRef.current &&
      matRef.current.uniforms &&
      matRef.current.uniforms.sunDirection
    ) {
      const sunWorldPos = new THREE.Vector3();
      sun.getWorldPosition(sunWorldPos);

      // If for some reason sunWorldPos is (0,0,0) (not ready), fallback to +X
      if (sunWorldPos.lengthSq() < 1e-6) {
        matRef.current.uniforms.sunDirection.value.set(1, 0, 0);
      } else {
        // normalize and make a robust choice for hemisphere sign so shader doesn't show only night by accident.
        const sdir = sunWorldPos.clone().normalize();

        // Heuristic: prefer the sun vector that points roughly toward +X hemisphere to avoid inverted lighting
        // when the scene uses different conventions; if sdir points strongly negative X, flip it slightly.
        // (EarthReal defines SUN_DIRECTION_NEGATE = false; this local heuristic only flips when clearly needed.)
        if (sdir.x < -0.7) {
          sdir.negate();
        }
        matRef.current.uniforms.sunDirection.value.copy(sdir);
      }
    } else if (
      matRef.current &&
      matRef.current.uniforms &&
      matRef.current.uniforms.sunDirection
    ) {
      // fallback default if sun not present
      matRef.current.uniforms.sunDirection.value.set(1, 0, 0);
    }
  });

  return (
    <shaderMaterial
      ref={matRef}
      uniforms={uniforms}
      vertexShader={`
        varying vec2 vUv;
        varying vec3 vNormal;
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }`}
      fragmentShader={`
        uniform sampler2D dayTexture;
        uniform sampler2D nightTexture;
        uniform vec3 sunDirection;
        varying vec2 vUv;
        varying vec3 vNormal;
        void main() {
          vec3 normal = normalize(vNormal);
          vec3 sunDir = normalize(sunDirection);
          float dotNL = dot(normal, sunDir);

          float mixAmount = smoothstep(-0.15, 0.35, dotNL);

          vec3 dayColor = texture2D(dayTexture, vUv).rgb;
          vec3 nightColor = texture2D(nightTexture, vUv).rgb;

          dayColor *= 1.35;
          nightColor *= 0.55;

          vec3 atmosphere = vec3(0.2, 0.35, 0.7) * pow(max(dotNL, 0.0), 3.0) * 0.8;

          float edgeGlow = smoothstep(0.0, 0.3, abs(dotNL));
          vec3 glowColor = vec3(0.05, 0.15, 0.3) * (1.0 - edgeGlow);

          vec3 color = mix(nightColor + glowColor, dayColor + atmosphere, mixAmount);

          gl_FragColor = vec4(color, 1.0);
        }`}
      lights={false}
      fog={false}
    />
  );
}

// ------------------- Sun & Moon (reuse) -------------------
function Sun({ simNowRef }) {
  const texture = useTexture(sunImg);
  const meshRef = useRef();
  const lightRef = useRef();
  const { scene } = useThree();
  const distanceEarthRadii = compressDistanceKmToEarthRadii(
    sunData.sun.average_distance_from_earth_km || 149597870
  );

  useFrame(() => {
    if (!simNowRef?.current) return;
    const simSec = simNowRef.current.getTime() / 1000;
    const angle =
      ((simSec % SUN_ORBIT_PERIOD_SEC) / SUN_ORBIT_PERIOD_SEC) * Math.PI * 2;
    const x = Math.cos(angle) * distanceEarthRadii;
    const z = Math.sin(angle) * distanceEarthRadii;
    if (meshRef.current) meshRef.current.position.set(x, 0, z);
    if (lightRef.current) {
      lightRef.current.position.set(x, 0, z);
      if (!lightRef.current.target) {
        lightRef.current.target = new THREE.Object3D();
        scene.add(lightRef.current.target);
      }
      lightRef.current.target.position.set(0, 0, 0);
      lightRef.current.target.updateMatrixWorld();
    }
  });

  return (
    <>
      <mesh ref={meshRef}>
        <sphereGeometry args={[12, 64, 64]} />
        <meshBasicMaterial map={texture} />
      </mesh>
      <directionalLight
        ref={lightRef}
        name="sunLight"
        intensity={4.5}
        color={"#ffffff"}
      />
    </>
  );
}

function Moon() {
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

  useFrame((state) => {
    const t = state.clock.getElapsedTime() * 0.2;
    const x = Math.cos(t) * moonDist;
    const z = Math.sin(t) * moonDist;
    const y = Math.sin(inclination) * z;
    if (moonRef.current) moonRef.current.position.set(x, y, z);
  });

  return (
    <mesh ref={moonRef}>
      <sphereGeometry args={[moonScale * 0.8, 64, 64]} />
      <meshPhongMaterial map={texture} shininess={5} />
    </mesh>
  );
}

// ------------------- Main chase component -------------------
export default function EarthChaseScene({ target }) {
  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <Canvas
        camera={{ position: [0, 2, 4], fov: 50 }}
        gl={{ antialias: true }}
      >
        <ambientLight intensity={1.2} />
        <hemisphereLight
          skyColor={0xffffff}
          groundColor={0x444444}
          intensity={1.0}
        />
        <pointLight intensity={0.3} position={[0, -5, 0]} />
        <React.Suspense fallback={null}>
          <ChaseEnvironment target={target} />
        </React.Suspense>
      </Canvas>
    </div>
  );
}

// ------------------- ChaseEnvironment -------------------
function ChaseEnvironment({ target }) {
  const { camera } = useThree();
  const satRef = useRef();
  const earthRef = useRef();
  const spaceRef = useRef();
  const controlsRef = useRef();
  const initialCamDistanceRef = useRef(null);
  const userOffsetRef = useRef(new THREE.Vector3(0, 0, 1));
  const isUserInteractingRef = useRef(false);
  const glb = useGLTF(satelliteGLB);

  const [dayMap, nightMap, cloudMap, starsMap] = useTexture([
    dayImg,
    nightImg,
    cloudsImg,
    starsImg,
  ]);
  useEffect(() => {
    [dayMap, nightMap, cloudMap, starsMap].forEach((t) => {
      if (t) t.encoding = THREE.sRGBEncoding;
    });
  }, [dayMap, nightMap, cloudMap, starsMap]);

  const simNowRef = useRef(new Date());

  useEffect(() => {
    if (glb && glb.scene && satRef.current) {
      const cloned = glb.scene.clone(true);
      const modelScale = 0.0008 * EARTH_RADIUS_LARGE; // a bit smaller per your last request
      cloned.scale.setScalar(modelScale);
      satRef.current.clear();
      satRef.current.add(cloned);
    }
  }, [glb]);

  // initial camera placement
  useEffect(() => {
    const id = setTimeout(() => {
      if (!satRef.current) return;
      const satPos = satRef.current.position.clone();
      const radial = satPos.clone().normalize();
      const cameraOffset = radial
        .clone()
        .multiplyScalar(0.09 * EARTH_RADIUS_LARGE);
      const initialCam = satPos.clone().add(cameraOffset);
      camera.position.copy(initialCam);
      camera.lookAt(satRef.current.position);
      camera.updateProjectionMatrix();

      userOffsetRef.current = camera.position
        .clone()
        .sub(satRef.current.position)
        .normalize();

      if (controlsRef.current) {
        controlsRef.current.target.copy(satRef.current.position);
        const initialDist = camera.position.distanceTo(satRef.current.position);
        initialCamDistanceRef.current = initialDist;
        controlsRef.current.minDistance = Math.max(
          0.02 * EARTH_RADIUS_LARGE,
          initialDist * 0.6
        );
        controlsRef.current.maxDistance = initialDist * MAX_ZOOM_OUT_RATIO;
        controlsRef.current.enableZoom = true;
        controlsRef.current.update();

        const onStart = () => {
          isUserInteractingRef.current = true;
        };
        const onEnd = () => {
          // When user ends interaction, capture the offset but clamp to keep camera outside the Earth.
          if (satRef.current) {
            const curOffset = camera.position
              .clone()
              .sub(satRef.current.position);
            if (curOffset.lengthSq() > 1e-6) {
              let n = curOffset.clone().normalize();
              // enforce minimum outward (radial) component
              const radialNow = satRef.current.position.clone().normalize();
              const dot = n.dot(radialNow);
              if (dot < MIN_RADIAL_COMPONENT) {
                // nudge n outward along radial so camera remains on outside hemisphere
                n.add(
                  radialNow
                    .clone()
                    .multiplyScalar(MIN_RADIAL_COMPONENT - dot + 0.02)
                );
                n.normalize();
              }
              userOffsetRef.current = n;
            }
          }
          isUserInteractingRef.current = false;

          // if camera somehow got inside (between Earth center and satellite), push it outward
          if (satRef.current) {
            const radialNow = satRef.current.position.clone().normalize();
            const camVec = camera.position
              .clone()
              .sub(satRef.current.position)
              .normalize();
            if (camVec.dot(radialNow) < 0.0) {
              const camDist =
                initialCamDistanceRef.current ?? 0.09 * EARTH_RADIUS_LARGE;
              const corrected = satRef.current.position
                .clone()
                .add(radialNow.clone().multiplyScalar(camDist));
              camera.position.copy(corrected);
              camera.lookAt(satRef.current.position);
            }
          }
        };

        controlsRef.current.addEventListener &&
          controlsRef.current.addEventListener("start", onStart);
        controlsRef.current.addEventListener &&
          controlsRef.current.addEventListener("end", onEnd);
      }
    }, 40);
    return () => clearTimeout(id);
  }, [camera, target]);

  useFrame((state, delta) => {
    simNowRef.current = new Date(
      simNowRef.current.getTime() + delta * 1000 * TIME_SCALE_FACTOR
    );

    // determine satellite normalized vector
    let satNorm = new THREE.Vector3(0, 0, 1);
    let altFraction = 0;
    if (target?.satrec) {
      const pos = propagateTLE_toFractionAlt(target.satrec, simNowRef.current);
      if (pos) {
        satNorm = latLngAltFractionToVec3(pos.lat, pos.lng, pos.altFraction);
        altFraction = pos.altFraction ?? 0;
      } else if (target?.position) {
        satNorm = new THREE.Vector3(...target.position);
      }
    } else if (target?.position) {
      satNorm = new THREE.Vector3(...target.position);
    } else {
      const t = state.clock.getElapsedTime() * 0.12;
      satNorm
        .set(Math.cos(t), Math.sin(t * 0.18) * 0.12, Math.sin(t))
        .normalize()
        .multiplyScalar(1.02);
    }

    const satWorld = satNorm
      .clone()
      .normalize()
      .multiplyScalar((1 + (altFraction || 0)) * EARTH_RADIUS_LARGE);
    if (satRef.current) {
      satRef.current.position.lerp(satWorld, 0.22);
    }

    // enforce camera chase but keep user orientation (clamped to outward hemisphere)
    if (satRef.current) {
      const satPosNow = satRef.current.position.clone();
      const radialNow = satPosNow.clone().normalize();
      const camDist =
        initialCamDistanceRef.current ?? 0.09 * EARTH_RADIUS_LARGE;

      if (!isUserInteractingRef.current) {
        // Ensure userOffsetRef has sufficient outward component; if not, nudge it now.
        let u = userOffsetRef.current.clone();
        const dot = u.dot(radialNow);
        if (dot < MIN_RADIAL_COMPONENT) {
          u.add(
            radialNow.clone().multiplyScalar(MIN_RADIAL_COMPONENT - dot + 0.02)
          ).normalize();
          userOffsetRef.current = u;
        }

        const desiredCamPos = satPosNow
          .clone()
          .add(userOffsetRef.current.clone().multiplyScalar(camDist));
        camera.position.lerp(desiredCamPos, 0.12);
      } else {
        // while interacting, do not override camera.position
      }

      // If camera is inside (dot negative) push it outward immediately
      const camVec = camera.position.clone().sub(satPosNow).normalize();
      if (camVec.dot(radialNow) < -0.02) {
        const corrected = satPosNow
          .clone()
          .add(radialNow.clone().multiplyScalar(camDist));
        camera.position.lerp(corrected, 0.5);
      }

      camera.lookAt(satRef.current.position);
      camera.updateProjectionMatrix();

      // update controls target to satellite
      if (controlsRef.current) {
        controlsRef.current.target.copy(satRef.current.position);
        const satCameraDist =
          camera.position.distanceTo(satRef.current.position) || camDist;
        controlsRef.current.minDistance = Math.max(
          0.01 * EARTH_RADIUS_LARGE,
          satCameraDist * 0.5
        );
        controlsRef.current.maxDistance = Math.max(
          satCameraDist * MAX_ZOOM_OUT_RATIO,
          camDist * MAX_ZOOM_OUT_RATIO
        );
        controlsRef.current.update();
      }
    }

    // Earth rotation (slow)
    const rotationRateDegPerSec =
      earthData.earth?.rotation_rate_deg_per_sec ?? 360 / (8 * 60);
    // we've set TIME_SCALE_FACTOR earlier for a slow rotation; keep same form
    const rotDelta = THREE.MathUtils.degToRad(
      rotationRateDegPerSec * TIME_SCALE_FACTOR * delta
    );
    if (earthRef.current) {
      earthRef.current.rotation.y += rotDelta;
    }

    if (earthRef.current?.children) {
      const clouds = earthRef.current.children.find(
        (c) => c.name === "__clouds_layer"
      );
      if (clouds) {
        clouds.rotation.y +=
          rotDelta *
          (earthData.earth?.clouds_config?.rotation_multiplier ?? 1.1);
      }
    }
  });

  return (
    <>
      {starsMap && (
        <mesh
          ref={spaceRef}
          frustumCulled={false}
          scale={[400, 400, 400]}
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

      <Sun simNowRef={simNowRef} />
      <Moon />

      <group>
        <mesh ref={earthRef}>
          <sphereGeometry args={[EARTH_RADIUS_LARGE, 256, 256]} />
          <EarthDayNightMaterial dayMap={dayMap} nightMap={nightMap} />
        </mesh>

        {cloudMap && (
          <mesh name="__clouds_layer" position={[0, 0, 0]}>
            <sphereGeometry args={[EARTH_RADIUS_LARGE * 1.001, 200, 200]} />
            <meshLambertMaterial
              map={cloudMap}
              transparent
              depthWrite={false}
              opacity={0.95}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {nightMap && (
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[EARTH_RADIUS_LARGE + 0.02, 256, 256]} />
            <meshBasicMaterial
              map={nightMap}
              transparent
              blending={THREE.AdditiveBlending}
              opacity={0.8}
              depthWrite={false}
            />
          </mesh>
        )}

        <group
          scale={[EARTH_RADIUS_LARGE, EARTH_RADIUS_LARGE, EARTH_RADIUS_LARGE]}
        >
          <AtmosphereGlow intensity={0.6} color={new THREE.Color(0x2a7fff)} />
        </group>
      </group>

      <group ref={satRef} />

      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        target={[0, 0, 0]}
        minPolarAngle={0.0}
        maxPolarAngle={Math.PI - 0.05}
      />
    </>
  );
}
