// SpaceBackground.jsx
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import spaceTexture from '../assets/spacetexture.jpg';

export default function SpaceBackground() {
  const texture = useTexture(spaceTexture);
  
  return (
    <mesh>
      <sphereGeometry args={[100, 64, 64]} />
      <meshBasicMaterial 
        map={texture} 
        side={THREE.BackSide}
        transparent={false}
      />
    </mesh>
  );
}