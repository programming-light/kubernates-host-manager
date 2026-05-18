"use client";

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ThreeJSIconProps {
  position: [number, number, number];
  color: string;
  speed?: number;
}

function FloatingIcon({ position, color, speed = 1 }: ThreeJSIconProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * speed) * 0.3;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.5 * speed;
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.2;
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

export function DockerIcon() {
  return (
    <Canvas camera={{ position: [0, 0, 3] }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 2, 2]} />
      <FloatingIcon position={[-1, 0, 0]} color="#2496ED" speed={1.2} />
      <FloatingIcon position={[1, 0.5, 0]} color="#2496ED" speed={0.8} />
    </Canvas>
  );
}

export function ServerIcon() {
  return (
    <Canvas camera={{ position: [0, 0, 3] }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 2, 2]} />
      <FloatingIcon position={[0, 0, 0]} color="#10b981" speed={1} />
    </Canvas>
  );
}

export function DatabaseIcon() {
  return (
    <Canvas camera={{ position: [0, 0, 3] }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 2, 2]} />
      <FloatingIcon position={[0, 0, 0]} color="#8b5cf6" speed={0.9} />
    </Canvas>
  );
}
