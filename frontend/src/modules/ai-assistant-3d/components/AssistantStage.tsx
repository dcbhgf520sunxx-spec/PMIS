import { Canvas } from '@react-three/fiber';
import { AssistantRobot, type RobotSkin } from './AssistantRobot';

type AssistantStageProps = {
  skin: RobotSkin;
  tone: 'light' | 'dark';
};

export function AssistantStage({ skin, tone }: AssistantStageProps) {
  return (
    <div className={`ai-assistant-stage ai-assistant-stage--${tone}`}>
      <Canvas
        camera={{ position: [0, 0.65, 4.5], fov: 42 }}
        dpr={[1, 1.8]}
        shadows
      >
        <color attach="background" args={[tone === 'dark' ? '#0b1020' : '#f8fbff']} />
        <ambientLight intensity={tone === 'dark' ? 0.85 : 1.15} />
        <directionalLight
          castShadow
          color={tone === 'dark' ? '#dce8ff' : '#ffffff'}
          intensity={2.4}
          position={[3, 4, 4]}
          shadow-mapSize={[1024, 1024]}
        />
        <pointLight color={skin.eye} intensity={1.4} position={[-1.8, 1.2, 2.2]} distance={6} />
        <pointLight color={tone === 'dark' ? '#6d5dfc' : '#81d8ff'} intensity={0.7} position={[2.2, -0.4, 2.4]} distance={5} />
        <AssistantRobot skin={skin} />
      </Canvas>
      <div className="ai-assistant-stage__label">
        <strong>{skin.name}</strong>
        <span>跑入场 · 待机悬浮 · 眨眼观察</span>
      </div>
    </div>
  );
}
