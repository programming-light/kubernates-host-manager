"use client";

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Cloud, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

function AnimatedCloud() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.3;
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.2;
    }
  });

  return (
    <group ref={groupRef}>
      <Cloud
        position={[-1, 0, 0]}
        scale={[2, 1.5, 1]}
        opacity={0.6}
        color="#3b82f6"
        speed={0.2}
      />
      <Cloud
        position={[1, 0.3, -1]}
        scale={[1.8, 1.3, 0.8]}
        opacity={0.5}
        color="#8b5cf6"
        speed={0.15}
      />
      <Cloud
        position={[0, -0.2, 1]}
        scale={[1.5, 1.2, 0.7]}
        opacity={0.4}
        color="#06b6d4"
        speed={0.25}
      />
    </group>
  );
}

export default function CloudAnimation() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <Canvas camera={{ position: [0, 0, 8], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />
        <AnimatedCloud />
      </Canvas>
    </div>
  );
}
