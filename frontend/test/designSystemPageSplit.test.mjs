import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pageRoot = new URL('../src/modules/design-system/pages/', import.meta.url);

function read(relativePath) {
  return readFileSync(new URL(relativePath, pageRoot), 'utf8');
}

function lineCount(content) {
  return content.split('\n').length;
}

test('组件工作台按分类拆分，主页面只负责分类装配', () => {
  const page = read('DesignSystemPage.tsx');
  const sections = [
    ['LayoutSection.tsx', 'LayoutSection.css', '<LayoutSection />'],
    ['DisplaySection.tsx', 'DisplaySection.css', '<DisplaySection />'],
    ['FeedbackSection.tsx', 'FeedbackSection.css', '<FeedbackSection />']
  ];

  for (const [componentFile, styleFile, usage] of sections) {
    const section = read(`sections/${componentFile}`);
    read(`sections/${styleFile}`);
    assert.match(section, new RegExp(`import './${styleFile.replace('.', '\\.')}'`));
    assert.ok(page.includes(usage), `${componentFile} 应由主页面直接装配`);
  }

  assert.ok(page.split('\n').length <= 130, 'DesignSystemPage.tsx 应只保留分类装配职责');
  for (const implementationDetail of [
    'layoutPatterns',
    'displayTableColumns',
    'StatusFlowModal',
    'TemplateDrawerTable',
    'useAdminFeedback'
  ]) {
    assert.ok(!page.includes(implementationDetail), `主页面不应继续持有 ${implementationDetail}`);
  }
});

test('布局、输入和反馈分类按独立示例组完成拆分', () => {
  const groups = [
    {
      shell: 'LayoutSection.tsx',
      components: [
        ['layout/layoutPatterns.tsx', 'layoutPatterns'],
        ['layout/ListTemplateDemo.tsx', '<ListTemplateDemo />']
      ],
      forbidden: ['useTemplateListPageData', 'HierarchyListCell', 'const layoutPatterns']
    },
    {
      shell: 'InputSection.tsx',
      components: [
        ['input/BasicInputExamples.tsx', '<BasicInputExamples />'],
        ['input/SelectionInputExamples.tsx', '<SelectionInputExamples />'],
        ['input/ChoiceInputExamples.tsx', '<ChoiceInputExamples />'],
        ['input/AdvancedInputExamples.tsx', '<AdvancedInputExamples']
      ],
      forbidden: ['AdminUpload', 'AdminTreeSelect', 'transferDataSource']
    },
    {
      shell: 'FeedbackSection.tsx',
      components: [
        ['feedback/FeedbackMessages.tsx', '<FeedbackMessages />'],
        ['feedback/FeedbackConfirmations.tsx', '<FeedbackConfirmations />'],
        ['feedback/FeedbackProgress.tsx', '<FeedbackProgress />'],
        ['feedback/FeedbackOverlays.tsx', '<FeedbackOverlays'],
        ['feedback/FeedbackTableDrawer.tsx', '<FeedbackTableDrawer']
      ],
      forbidden: ['StatusFlowModal', 'TemplateDrawerTable', 'useAdminFeedback']
    }
  ];

  for (const group of groups) {
    const shell = read(`sections/${group.shell}`);
    assert.ok(lineCount(shell) <= 180, `${group.shell} 应只负责示例组装配`);

    for (const [componentFile, usage] of group.components) {
      const component = read(`sections/${componentFile}`);
      assert.ok(lineCount(component) <= 500, `${componentFile} 不应重新形成超大文件`);
      assert.ok(shell.includes(usage), `${group.shell} 应装配 ${componentFile}`);
    }

    for (const implementationDetail of group.forbidden) {
      assert.ok(!shell.includes(implementationDetail), `${group.shell} 不应继续持有 ${implementationDetail}`);
    }
  }
});

test('组件工作台公共样式与复杂示例样式分层维护', () => {
  const page = read('DesignSystemPage.tsx');
  const pageStyle = read('DesignSystemPage.css');
  const styleFiles = [
    'DesignSystemShared.css',
    'DesignSystemUtilities.css',
    'sections/FoundationSection.css',
    'sections/layout/LayoutPatternGallery.css',
    'sections/layout/LayoutPatternPreviews.css',
    'sections/layout/ListTemplateDemo.css'
  ];

  for (const styleFile of styleFiles) {
    read(styleFile);
  }

  assert.match(page, /import '.\/DesignSystemShared\.css'/);
  assert.ok(lineCount(pageStyle) <= 400, 'DesignSystemPage.css 应只保留页面壳样式');
});
