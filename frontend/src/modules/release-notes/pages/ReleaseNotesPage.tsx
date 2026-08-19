import {
  AdminCollapse,
  AdminText,
  CategoryTag,
  defineCategoryToneMap,
  TemplateDetailPage,
  TemplateDetailSection
} from '../../../components/admin';
import {
  currentRelease,
  releaseCategoryDefinitions,
  releaseNotes,
  type ReleaseNote
} from '../releaseNotes';
import './ReleaseNotesPage.css';

const releaseCategoryTones = defineCategoryToneMap({
  current: 'magenta',
  features: 'blue',
  improvements: 'cyan',
  fixes: 'indigo',
  security: 'violet'
});

function ReleaseCategories({ release }: { release: ReleaseNote }) {
  const categories = releaseCategoryDefinitions.filter(({ key }) => release[key].length > 0);
  return (
    <div className="release-notes__categories">
      {categories.map(({ key, label }) => (
        <div key={key} className="release-notes__category">
          <div className="release-notes__category-title">
            <CategoryTag tone={releaseCategoryTones[key]}>{label}</CategoryTag>
            <AdminText type="secondary">{release[key].length} 项</AdminText>
          </div>
          <ul className="release-notes__list">
            {release[key].map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}

function CurrentRelease({ release }: { release: ReleaseNote }) {
  return (
    <div className="release-notes__release">
      <div className="release-notes__release-heading">
        <div>
          <CategoryTag tone={releaseCategoryTones.current}>当前版本</CategoryTag>
          <AdminText strong>{release.version}</AdminText>
          <AdminText className="release-notes__current-summary">{release.summary}</AdminText>
        </div>
        <AdminText type="secondary">{release.releasedAt}</AdminText>
      </div>
      <ReleaseCategories release={release} />
    </div>
  );
}

export function ReleaseNotesPage() {
  const history = releaseNotes.slice(1);
  return (
    <TemplateDetailPage title="版本更新">
      <TemplateDetailSection title="本次更新">
        <CurrentRelease release={currentRelease} />
      </TemplateDetailSection>

      <TemplateDetailSection title="历史版本">
        {history.length ? (
          <AdminCollapse
            className="release-notes__history"
            items={history.map((release) => ({
              key: release.version,
              label: (
                <div className="release-notes__history-label">
                  <AdminText strong>{release.version}</AdminText>
                  <AdminText className="release-notes__history-summary">{release.summary}</AdminText>
                  <AdminText className="release-notes__history-date" type="secondary">
                    {release.releasedAt}
                  </AdminText>
                </div>
              ),
              children: <ReleaseCategories release={release} />
            }))}
          />
        ) : <AdminText type="secondary">暂无历史版本</AdminText>}
      </TemplateDetailSection>

    </TemplateDetailPage>
  );
}
