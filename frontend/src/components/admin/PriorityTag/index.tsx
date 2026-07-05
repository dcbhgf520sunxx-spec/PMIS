import { Tag } from 'antd';
import './index.css';

const toneMap = {
  critical: { tone: 'critical', text: '紧急' },
  high: { tone: 'high', text: '高' },
  medium: { tone: 'medium', text: '中' },
  low: { tone: 'low', text: '低' },
  none: { tone: 'none', text: '无' }
} as const;

export type PriorityLevel = keyof typeof toneMap;

export function PriorityTag({ level, text }: { level: PriorityLevel; text?: string }) {
  const tone = toneMap[level] || toneMap.none;
  return <Tag className={`admin-priority-tag admin-priority-tag--${tone.tone}`}>{text || tone.text}</Tag>;
}
