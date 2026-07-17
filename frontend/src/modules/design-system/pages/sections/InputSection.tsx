import { AdminCard } from '../../../../components/admin';
import { AdvancedInputExamples } from './input/AdvancedInputExamples';
import { BasicInputExamples } from './input/BasicInputExamples';
import { ChoiceInputExamples } from './input/ChoiceInputExamples';
import { SelectionInputExamples } from './input/SelectionInputExamples';

const inputComponentSpecs = [
  { label: '高度', value: '默认 32px，同一区域控件高度必须一致' },
  { label: '宽度', value: '同一行字段宽度一致，长文本独占整行' },
  { label: '必填', value: '红星只标识必填，不替代校验提示' },
  { label: '校验', value: '错误提示必须中文、明确、可执行' },
  { label: '悬浮 / 聚焦', value: '统一蓝色边框和轻量外圈' },
  { label: '文案', value: '占位、选项、空状态和提示不出现英文' }
];

type InputSectionProps = { richText: string; setRichText: (value: string) => void };

export function InputSection({ richText, setRichText }: InputSectionProps) {
  return (
    <div className="design-system-page__input">
      <AdminCard title="输入组件规范">
        <div className="design-system-page__base-rule-grid">
          {inputComponentSpecs.map((item) => (
            <section className="design-system-page__base-rule-card" key={item.label}>
              <h3>{item.label}</h3><p>{item.value}</p>
            </section>
          ))}
        </div>
      </AdminCard>
      <BasicInputExamples />
      <SelectionInputExamples />
      <ChoiceInputExamples />
      <AdvancedInputExamples richText={richText} setRichText={setRichText} />
    </div>
  );
}
