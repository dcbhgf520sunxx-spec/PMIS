import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageShell } from '../../../components/admin';
import { type DesignCategory, isDesignCategory } from '../categories';
import { BaseSection } from './sections/BaseSection';
import { DisplaySection } from './sections/DisplaySection';
import { FeedbackSection } from './sections/FeedbackSection';
import { FoundationSection } from './sections/FoundationSection';
import { InputSection } from './sections/InputSection';
import { LayoutSection } from './sections/LayoutSection';
import { OverviewSection } from './sections/OverviewSection';
import './DesignSystemPage.css';
import './DesignSystemShared.css';
import './DesignSystemUtilities.css';

export function DesignSystemPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const contentRef = useRef<HTMLDivElement>(null);
  const [richText, setRichText] = useState('<p><strong>项目说明：</strong>这里用于沉淀可复用富文本描述，支持基础格式和粘贴图片。</p>');
  const categoryParam = searchParams.get('category');
  const activeCategory: DesignCategory = isDesignCategory(categoryParam) ? categoryParam : 'overview';

  useEffect(() => {
    if (categoryParam !== null && !isDesignCategory(categoryParam)) {
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.set('category', 'overview');
      setSearchParams(nextSearchParams, { replace: true });
    }
  }, [categoryParam, searchParams, setSearchParams]);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, left: 0 });
  }, [activeCategory]);

  return (
    <div className="design-system-page">
      <PageShell title="组件工作台" compact>
        <div ref={contentRef} className="design-system-page__content">
          {activeCategory === 'overview' ? <div className="design-system-page__section design-system-page__overview-section"><OverviewSection /></div> : null}
          {activeCategory === 'foundation' ? <div className="design-system-page__section"><FoundationSection /></div> : null}
          {activeCategory === 'base' ? <div className="design-system-page__section"><BaseSection /></div> : null}
          {activeCategory === 'input' ? <div className="design-system-page__section"><InputSection richText={richText} setRichText={setRichText} /></div> : null}
          {activeCategory === 'layout' ? <LayoutSection /> : null}
          {activeCategory === 'display' ? <DisplaySection /> : null}
          {activeCategory === 'feedback' ? <FeedbackSection /> : null}
        </div>
      </PageShell>
    </div>
  );
}
