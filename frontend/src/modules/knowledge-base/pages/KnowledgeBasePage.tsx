import { AdminEmptyState, PageShell } from '../../../components/admin';
import './KnowledgeBasePage.css';

export function KnowledgeBasePage() {
  return (
    <PageShell title="知识库">
      <div className="knowledge-base-page__empty">
        <AdminEmptyState
          className="knowledge-base-page__construction"
          description="知识库正在建设中，敬请期待"
        />
      </div>
    </PageShell>
  );
}
