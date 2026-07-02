import { Suspense, useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

function ParticleNetwork() {
  const ref = useRef();
  const count = 1200;

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2 + Math.random() * 0.6;
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
      // gradient blue to cyan
      const t = Math.random();
      col[i * 3]     = 0.145 + t * 0.196; // R: 37..87 → brand to tosca
      col[i * 3 + 1] = 0.388 + t * 0.26;  // G
      col[i * 3 + 2] = 0.922 + t * 0.056; // B
    }
    return [pos, col];
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    ref.current.rotation.y = t * 0.08;
    ref.current.rotation.x = Math.sin(t * 0.04) * 0.25;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={count} itemSize={3} />
        <bufferAttribute attach="attributes-color"    array={colors}    count={count} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.025} vertexColors transparent opacity={0.9} sizeAttenuation />
    </points>
  );
}

function InnerRing() {
  const ref = useRef();
  useFrame((state) => {
    ref.current.rotation.x = state.clock.elapsedTime * 0.15;
    ref.current.rotation.z = state.clock.elapsedTime * 0.07;
  });
  return (
    <mesh ref={ref}>
      <torusGeometry args={[1.6, 0.008, 8, 120]} />
      <meshBasicMaterial color="#0ea5e9" transparent opacity={0.35} />
    </mesh>
  );
}

function OuterRing() {
  const ref = useRef();
  useFrame((state) => {
    ref.current.rotation.y = state.clock.elapsedTime * 0.1;
    ref.current.rotation.x = Math.cos(state.clock.elapsedTime * 0.06) * 0.8;
  });
  return (
    <mesh ref={ref}>
      <torusGeometry args={[2.3, 0.005, 8, 140]} />
      <meshBasicMaterial color="#2563eb" transparent opacity={0.25} />
    </mesh>
  );
}

export default function HeroCanvas() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 50 }}
      gl={{ antialias: true, alpha: true }}
      style={{ width: "100%", height: "100%" }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[5, 5, 5]} intensity={1} color="#0ea5e9" />
      <pointLight position={[-5, -5, -5]} intensity={0.5} color="#2563eb" />
      <Suspense fallback={null}>
        <ParticleNetwork />
        <InnerRing />
        <OuterRing />
      </Suspense>
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.5} />
    </Canvas>
  );
}
