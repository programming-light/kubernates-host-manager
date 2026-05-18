"use client";

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface FloatingIcon3DProps {
  position: [number, number, number];
  color: string;
  shape: 'box' | 'sphere' | 'cylinder';
  speed?: number;
}

function FloatingIcon3D({ position, color, shape, speed = 1 }: FloatingIcon3DProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * speed + position[0]) * 0.5;
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.3 * speed;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.5 * speed;
    }
  });

  const geometry = () => {
    switch (shape) {
      case 'sphere':
        return <sphereGeometry args={[0.4, 16, 16]} />;
      case 'cylinder':
        return <cylinderGeometry args={[0.3, 0.3, 0.6, 16]} />;
      default:
        return <boxGeometry args={[0.6, 0.6, 0.6]} />;
    }
  };

  return (
    <mesh ref={meshRef} position={position}>
      {geometry()}
      <meshStandardMaterial color={color} transparent opacity={0.6} />
    </mesh>
  );
}

export default function TechIcons3D() {
  return (
    <div className="absolute inset-0 overflow-hidden opacity-25 pointer-events-none">
      <Canvas camera={{ position: [0, 0, 10], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        
        {/* Terminal icon - box shape */}
        <FloatingIcon3D position={[-4, 2, 0]} color="#10b981" shape="box" speed={1.2} />
        
        {/* CPU icon - box shape */}
        <FloatingIcon3D position={[4, 1, -1]} color="#3b82f6" shape="box" speed={0.8} />
        
        {/* Database icon - cylinder shape */}
        <FloatingIcon3D position={[-2, -2, 1]} color="#8b5cf6" shape="cylinder" speed={1} />
        
        {/* Globe icon - sphere shape */}
        <FloatingIcon3D position={[3, -1, 0]} color="#06b6d4" shape="sphere" speed={0.9} />
        
        {/* Server icon - box shape */}
        <FloatingIcon3D position={[0, 2.5, -1]} color="#eab308" shape="box" speed={1.1} />
        
        {/* Container icon - cylinder shape */}
        <FloatingIcon3D position={[-3, 0, 1]} color="#ec4899" shape="cylinder" speed={0.7} />
        
        {/* Network icon - sphere shape */}
        <FloatingIcon3D position={[2, -2.5, 0]} color="#10b981" shape="sphere" speed={1.3} />
        
        {/* Zap icon - box shape */}
        <FloatingIcon3D position={[-1, -3, -1]} color="#f59e0b" shape="box" speed={1.5} />
      </Canvas>
    </div>
  );
}
