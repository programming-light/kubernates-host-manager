"use client";

import { useState, useEffect, useRef } from 'react';

interface TrailPoint {
  x: number;
  y: number;
  opacity: number;
}

export default function CustomCursor() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);
  const [trail, setTrail] = useState<TrailPoint[]>([]);
  const requestRef = useRef<number>(0);
  const positionRef = useRef({ x: 0, y: 0 });
  const prevPositionRef = useRef({ x: 0, y: 0 });
  const isMovingRef = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      prevPositionRef.current = positionRef.current;
      positionRef.current = { x: e.clientX, y: e.clientY };
      setPosition({ x: e.clientX, y: e.clientY });
      setVisible(true);
      
      // Check if actually moving
      const dx = e.clientX - prevPositionRef.current.x;
      const dy = e.clientY - prevPositionRef.current.y;
      isMovingRef.current = Math.sqrt(dx*dx + dy*dy) > 2;
    };

    const handleMouseLeave = () => setVisible(false);

    window.addEventListener('mousemove', handleMouseMove);
    document.body.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.body.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  useEffect(() => {
    const animate = () => {
      setTrail((prevTrail) => {
        const newTrail = [...prevTrail];
        
        // Only add trail point if moving
        if (isMovingRef.current) {
          newTrail.unshift({
            x: positionRef.current.x,
            y: positionRef.current.y,
            opacity: 0.5,
          });
        }
        
        // Limit trail length to 4 (very subtle like Excalidraw)
        if (newTrail.length > 4) {
          newTrail.pop();
        }
        
        // Fade out trail points quickly
        newTrail.forEach((point, i) => {
          point.opacity = 0.5 - (i / 4) * 0.5;
        });
        
        // Clear trail if not moving
        if (!isMovingRef.current && newTrail.length > 0) {
          newTrail.pop();
        }
        
        return newTrail;
      });
      
      requestRef.current = requestAnimationFrame(animate);
    };
    
    requestRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, []);

  if (!visible) return null;

  return (
    <>
      {/* Trail dots - subtle like Excalidraw */}
      {trail.map((point, i) => (
        <div
          key={i}
          className="fixed pointer-events-none z-[9998]"
          style={{
            left: point.x - 1.5,
            top: point.y - 1.5,
            width: 3,
            height: 3,
            borderRadius: '50%',
            backgroundColor: '#60a5fa',
            opacity: point.opacity * 0.5,
          }}
        />
      ))}
      
      {/* Main cursor arrow - clean like Excalidraw */}
      <div
        className="fixed pointer-events-none z-[9999]"
        style={{
          left: position.x,
          top: position.y,
          width: 14,
          height: 14,
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M1 1L5.5 12L7 7L12 5.5L1 1Z"
            fill="white"
            stroke="white"
            strokeWidth="0.5"
          />
        </svg>
      </div>
    </>
  );
}
