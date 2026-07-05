import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

export type RobotSkin = {
  name: string;
  shell: string;
  shellSecondary: string;
  trim: string;
  joint: string;
  face: string;
  eye: string;
  eyeCore: string;
  footGlow: string;
  floor: string;
};

type AssistantRobotProps = {
  skin: RobotSkin;
  startOffset?: number;
};

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function useReducedMotion() {
  return useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);
}

export function AssistantRobot({ skin, startOffset = 0 }: AssistantRobotProps) {
  const rootRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const footGlowRef = useRef<THREE.Mesh>(null);
  const reducedMotion = useReducedMotion();

  useFrame(({ clock }) => {
    const elapsed = Math.max(0, clock.getElapsedTime() - startOffset);
    const introProgress = reducedMotion ? 1 : Math.min(elapsed / 2.25, 1);
    const easedIntro = easeOutCubic(introProgress);
    const running = introProgress < 1;
    const cycle = elapsed * 9;
    const idleTime = Math.max(0, elapsed - 2.25);
    const hover = running || reducedMotion ? 0 : Math.sin(idleTime * 2.1) * 0.045;
    const stride = running ? Math.sin(cycle) : Math.sin(idleTime * 1.2) * 0.1;
    const blink = running ? 1 : Math.max(0.16, Math.sin(idleTime * 2.8) > 0.955 ? 0.16 : 1);

    if (rootRef.current) {
      rootRef.current.position.x = reducedMotion ? 0 : -2.8 + easedIntro * 2.8;
      rootRef.current.position.y = hover;
      rootRef.current.rotation.y = running ? -0.08 + Math.sin(cycle) * 0.025 : Math.sin(idleTime * 0.7) * 0.1;
    }

    if (headRef.current) {
      headRef.current.rotation.y = running ? Math.sin(cycle * 0.45) * 0.05 : Math.sin(idleTime * 0.95) * 0.15;
      headRef.current.rotation.x = running ? 0.03 : Math.sin(idleTime * 1.1) * 0.022;
    }

    if (leftArmRef.current) leftArmRef.current.rotation.x = running ? -stride * 0.58 : -0.06 + Math.sin(idleTime * 1.25) * 0.035;
    if (rightArmRef.current) rightArmRef.current.rotation.x = running ? stride * 0.58 : -0.06 - Math.sin(idleTime * 1.25) * 0.035;
    if (leftLegRef.current) leftLegRef.current.rotation.x = running ? stride * 0.68 : Math.sin(idleTime * 1.1) * 0.025;
    if (rightLegRef.current) rightLegRef.current.rotation.x = running ? -stride * 0.68 : -Math.sin(idleTime * 1.1) * 0.025;

    if (leftEyeRef.current && rightEyeRef.current) {
      leftEyeRef.current.scale.y = blink;
      rightEyeRef.current.scale.y = blink;
    }

    if (footGlowRef.current) {
      const pulse = running ? 0.58 + Math.abs(Math.sin(cycle)) * 0.24 : 0.42 + Math.sin(idleTime * 2.4) * 0.06;
      footGlowRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group ref={rootRef} position={[0, 0, 0]} scale={1.08}>
      <mesh position={[0, -0.78, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.26, 72]} />
        <meshBasicMaterial color={skin.floor} transparent opacity={0.2} />
      </mesh>

      <mesh position={[0, -0.735, 0.025]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.54, 1.04, 72]} />
        <meshBasicMaterial color={skin.floor} transparent opacity={0.18} side={THREE.DoubleSide} />
      </mesh>

      <mesh ref={footGlowRef} position={[0, -0.73, 0.03]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.34, 0.78, 72]} />
        <meshBasicMaterial color={skin.footGlow} transparent opacity={0.34} side={THREE.DoubleSide} />
      </mesh>

      <group ref={headRef} position={[0, 0.86, 0]}>
        <mesh scale={[1.04, 0.9, 0.82]} castShadow>
          <sphereGeometry args={[0.58, 48, 30]} />
          <meshStandardMaterial color={skin.shell} roughness={0.27} metalness={0.18} />
        </mesh>

        <mesh position={[0, 0.38, 0.1]} scale={[0.72, 0.08, 0.48]} castShadow>
          <sphereGeometry args={[0.34, 32, 12]} />
          <meshStandardMaterial color={skin.trim} roughness={0.3} metalness={0.25} />
        </mesh>

        <mesh position={[-0.58, 0.02, 0.02]} scale={[0.18, 0.32, 0.18]} castShadow>
          <sphereGeometry args={[0.32, 24, 16]} />
          <meshStandardMaterial color={skin.trim} roughness={0.34} metalness={0.22} />
        </mesh>
        <mesh position={[0.58, 0.02, 0.02]} scale={[0.18, 0.32, 0.18]} castShadow>
          <sphereGeometry args={[0.32, 24, 16]} />
          <meshStandardMaterial color={skin.trim} roughness={0.34} metalness={0.22} />
        </mesh>

        <mesh position={[0, 0.02, 0.615]} castShadow>
          <boxGeometry args={[0.74, 0.31, 0.055]} />
          <meshStandardMaterial color={skin.face} roughness={0.15} metalness={0.22} />
        </mesh>
        <mesh position={[-0.37, 0.02, 0.615]} scale={[0.075, 0.168, 0.034]} castShadow>
          <sphereGeometry args={[1, 22, 14]} />
          <meshStandardMaterial color={skin.face} roughness={0.15} metalness={0.22} />
        </mesh>
        <mesh position={[0.37, 0.02, 0.615]} scale={[0.075, 0.168, 0.034]} castShadow>
          <sphereGeometry args={[1, 22, 14]} />
          <meshStandardMaterial color={skin.face} roughness={0.15} metalness={0.22} />
        </mesh>
        <mesh position={[0, 0.12, 0.65]}>
          <boxGeometry args={[0.54, 0.025, 0.012]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.18} />
        </mesh>

        <mesh ref={leftEyeRef} position={[-0.2, 0.035, 0.665]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.045, 0.075, 6, 18]} />
          <meshStandardMaterial color={skin.eye} emissive={skin.eye} emissiveIntensity={1.75} roughness={0.16} />
        </mesh>
        <mesh ref={rightEyeRef} position={[0.2, 0.035, 0.665]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.045, 0.075, 6, 18]} />
          <meshStandardMaterial color={skin.eye} emissive={skin.eye} emissiveIntensity={1.75} roughness={0.16} />
        </mesh>
        <mesh position={[0, 0.035, 0.67]}>
          <sphereGeometry args={[0.035, 18, 10]} />
          <meshStandardMaterial color={skin.eyeCore} emissive={skin.eyeCore} emissiveIntensity={2.1} roughness={0.14} />
        </mesh>
        <pointLight position={[0, 0.04, 0.82]} intensity={0.8} color={skin.eye} distance={2.6} />
      </group>

      <mesh position={[0, 0.31, 0]} scale={[0.62, 0.16, 0.42]} castShadow>
        <sphereGeometry args={[0.42, 32, 16]} />
        <meshStandardMaterial color={skin.trim} roughness={0.36} metalness={0.24} />
      </mesh>

      <mesh position={[0, 0.05, 0]} scale={[0.86, 1, 0.72]} castShadow>
        <sphereGeometry args={[0.43, 40, 24]} />
        <meshStandardMaterial color={skin.shellSecondary} roughness={0.32} metalness={0.16} />
      </mesh>
      <mesh position={[0, 0.18, 0.39]} scale={[0.8, 0.48, 0.18]} castShadow>
        <sphereGeometry args={[0.18, 28, 14]} />
        <meshStandardMaterial color={skin.trim} roughness={0.28} metalness={0.24} />
      </mesh>
      <mesh position={[0, 0.22, 0.54]} castShadow>
        <sphereGeometry args={[0.058, 20, 12]} />
        <meshStandardMaterial color={skin.eye} emissive={skin.eye} emissiveIntensity={1.2} roughness={0.18} />
      </mesh>
      <mesh position={[0, -0.32, 0]} scale={[0.58, 0.1, 0.38]} castShadow>
        <sphereGeometry args={[0.32, 28, 12]} />
        <meshStandardMaterial color={skin.trim} roughness={0.36} metalness={0.24} />
      </mesh>

      <group ref={leftArmRef} position={[-0.46, 0.25, 0]} rotation={[0, 0, 0.06]}>
        <mesh position={[-0.03, -0.06, 0]} scale={[1, 0.72, 1]} castShadow>
          <sphereGeometry args={[0.13, 20, 12]} />
          <meshStandardMaterial color={skin.trim} roughness={0.34} metalness={0.22} />
        </mesh>
        <mesh position={[0, -0.31, 0]} castShadow>
          <capsuleGeometry args={[0.075, 0.36, 8, 18]} />
          <meshStandardMaterial color={skin.joint} roughness={0.42} metalness={0.28} />
        </mesh>
        <mesh position={[0, -0.57, 0.03]} scale={[1, 0.78, 1]} castShadow>
          <sphereGeometry args={[0.105, 20, 14]} />
          <meshStandardMaterial color={skin.shell} roughness={0.28} metalness={0.16} />
        </mesh>
      </group>

      <group ref={rightArmRef} position={[0.46, 0.25, 0]} rotation={[0, 0, -0.06]}>
        <mesh position={[0.03, -0.06, 0]} scale={[1, 0.72, 1]} castShadow>
          <sphereGeometry args={[0.13, 20, 12]} />
          <meshStandardMaterial color={skin.trim} roughness={0.34} metalness={0.22} />
        </mesh>
        <mesh position={[0, -0.31, 0]} castShadow>
          <capsuleGeometry args={[0.075, 0.36, 8, 18]} />
          <meshStandardMaterial color={skin.joint} roughness={0.42} metalness={0.28} />
        </mesh>
        <mesh position={[0, -0.57, 0.03]} scale={[1, 0.78, 1]} castShadow>
          <sphereGeometry args={[0.105, 20, 14]} />
          <meshStandardMaterial color={skin.shell} roughness={0.28} metalness={0.16} />
        </mesh>
      </group>

      <group ref={leftLegRef} position={[-0.18, -0.25, 0]}>
        <mesh position={[0, -0.22, 0]} castShadow>
          <capsuleGeometry args={[0.082, 0.36, 8, 18]} />
          <meshStandardMaterial color={skin.joint} roughness={0.42} metalness={0.28} />
        </mesh>
        <mesh position={[0.025, -0.49, 0.105]} scale={[1.55, 0.52, 1.05]} castShadow>
          <sphereGeometry args={[0.14, 20, 12]} />
          <meshStandardMaterial color={skin.shell} roughness={0.28} metalness={0.16} />
        </mesh>
        <mesh position={[0.025, -0.48, 0.205]} scale={[0.98, 0.2, 0.52]}>
          <sphereGeometry args={[0.11, 18, 10]} />
          <meshBasicMaterial color={skin.footGlow} transparent opacity={0.32} />
        </mesh>
      </group>

      <group ref={rightLegRef} position={[0.18, -0.25, 0]}>
        <mesh position={[0, -0.22, 0]} castShadow>
          <capsuleGeometry args={[0.082, 0.36, 8, 18]} />
          <meshStandardMaterial color={skin.joint} roughness={0.42} metalness={0.28} />
        </mesh>
        <mesh position={[0.025, -0.49, 0.105]} scale={[1.55, 0.52, 1.05]} castShadow>
          <sphereGeometry args={[0.14, 20, 12]} />
          <meshStandardMaterial color={skin.shell} roughness={0.28} metalness={0.16} />
        </mesh>
        <mesh position={[0.025, -0.48, 0.205]} scale={[0.98, 0.2, 0.52]}>
          <sphereGeometry args={[0.11, 18, 10]} />
          <meshBasicMaterial color={skin.footGlow} transparent opacity={0.32} />
        </mesh>
      </group>
    </group>
  );
}
