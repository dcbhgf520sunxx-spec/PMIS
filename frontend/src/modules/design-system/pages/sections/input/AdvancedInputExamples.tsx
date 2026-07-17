import { CloudUploadOutlined } from '@ant-design/icons';
import {
  AdminButton, AdminCard, AdminColorPicker, AdminUpload, AdminUploadDragger,
  RichDescriptionEditor
} from '../../../../../components/admin';
import { ComponentEntry } from '../../components/ComponentEntry';

type AdvancedInputExamplesProps = {
  richText: string;
  setRichText: (value: string) => void;
};

export function AdvancedInputExamples({ richText, setRichText }: AdvancedInputExamplesProps) {
  return (
    <>
      <AdminCard title="9. 上传">
        <div className="design-system-page__input-grid">
          <section className="design-system-page__input-panel">
            <div className="design-system-page__input-panel-head">
              <h3>上传</h3>
              <p>用于附件、截图、导入文件，上传入口要清晰，限制条件写在提示里。</p>
            </div>
            <div className="design-system-page__input-demo-list design-system-page__input-demo-list--stack">
              <div className="design-system-page__input-demo">
                <h4>基础上传</h4>
                <ComponentEntry name="AdminUpload" />
                <AdminUpload beforeUpload={() => false} maxCount={1}>
                  <AdminButton icon={<CloudUploadOutlined />}>选择文件</AdminButton>
                </AdminUpload>
              </div>
              <div className="design-system-page__input-demo is-wide">
                <h4>拖拽上传</h4>
                <ComponentEntry name="AdminUploadDragger" />
                <AdminUploadDragger beforeUpload={() => false} maxCount={1}>
                  <div className="design-system-page__upload-drag-content">
                    <p className="ant-upload-text">
                      <CloudUploadOutlined />
                      <span>拖拽文件到此处，或点击上传</span>
                    </p>
                    <p className="ant-upload-hint">支持图片、文档，单个文件不超过 20MB</p>
                  </div>
                </AdminUploadDragger>
              </div>
            </div>
          </section>
        </div>
      </AdminCard>

      <AdminCard title="10. 颜色选择器">
        <div className="design-system-page__input-grid">
          <section className="design-system-page__input-panel">
            <div className="design-system-page__input-panel-head">
              <h3>颜色选择器</h3>
              <p>只用于需要人工配置色值的场景，默认色要和主题变量保持一致。</p>
            </div>
            <div className="design-system-page__input-demo-list">
              <div className="design-system-page__input-demo">
                <h4>基础颜色</h4>
                <ComponentEntry name="AdminColorPicker" />
                <AdminColorPicker className="design-system-page__color-picker" defaultValue="var(--app-primary-hover)" />
              </div>
              <div className="design-system-page__input-demo">
                <h4>预设颜色</h4>
                <ComponentEntry name="AdminColorPicker" />
                <AdminColorPicker
                  className="design-system-page__color-picker"
                  defaultValue="#0f42d2"
                  presets={[
                    {
                      label: '主题色',
                      colors: ['var(--app-primary-hover)', '#0f42d2', 'var(--app-cyan-deep)', 'var(--app-steel)']
                    }
                  ]}
                />
              </div>
            </div>
          </section>
        </div>
      </AdminCard>

      <AdminCard title="11. 富文本编辑器">
        <div className="design-system-page__input-grid">
          <section className="design-system-page__input-panel is-wide">
            <div className="design-system-page__input-panel-head">
              <h3>富文本编辑器</h3>
              <ComponentEntry name="RichDescriptionEditor" />
              <p>适合问题描述、处理记录，支持粘贴图片并调整图片大小。</p>
            </div>
            <RichDescriptionEditor value={richText} onChange={setRichText} />
          </section>
        </div>
      </AdminCard>
    </>
  );
}
