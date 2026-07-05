import { AssistantStage } from '../components/AssistantStage';
import type { RobotSkin } from '../components/AssistantRobot';
import './AiAssistant3DPage.css';

const lightSkin: RobotSkin = {
  name: '白色科技感',
  shell: '#f6fbff',
  shellSecondary: '#cfdfec',
  trim: '#9fb6c9',
  joint: '#16263a',
  face: '#050b16',
  eye: '#8ffcf0',
  eyeCore: '#29e6d0',
  footGlow: '#22d3ee',
  floor: '#9adcf4'
};

const darkSkin: RobotSkin = {
  name: '深色高级感',
  shell: '#101827',
  shellSecondary: '#1e3150',
  trim: '#526987',
  joint: '#a9b9d2',
  face: '#050816',
  eye: '#d8c8ff',
  eyeCore: '#8b7dff',
  footGlow: '#38bdf8',
  floor: '#6366f1'
};

export function AiAssistant3DPage() {
  return (
    <main className="ai-assistant-page">
      <section className="ai-assistant-page__header" aria-labelledby="ai-assistant-title">
        <div>
          <p className="ai-assistant-page__eyebrow">AI Assistant 3D Prototype</p>
          <h1 id="ai-assistant-title">企业 AI 数字助理</h1>
        </div>
        <p>
          更偏正式资产感的圆润 AI 助理，保留克制亲和的动作和深色屏幕脸。先比较两个主皮肤，再决定后续嵌入登录页或后台助手入口。
        </p>
      </section>

      <section className="ai-assistant-page__grid" aria-label="3D 小人物皮肤对比">
        <AssistantStage skin={lightSkin} tone="light" />
        <AssistantStage skin={darkSkin} tone="dark" />
      </section>
    </main>
  );
}
