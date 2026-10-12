import { QuestionCircleOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { getBusinessOntology } from '../../../api/businessOntologyApi';
import { AdminButton, AdminCollapse, AdminEmptyState, AdminIconAction, AdminPopover, AdminSplitPane, DetailSectionNavigation, TemplateDetailPage, TemplateDetailSection } from '../../../components/admin';
import { useAuthStore } from '../../../stores/authStore';
import { OntologyGraph } from '../components/OntologyGraph';
import { expandedRelationKeys, focusAfterExpansion, relationKey } from '../relationExpansion';
import './BusinessOntologyPage.css';
const objectGroups = [
  { title: '产品与实施', objects: ['Product', 'Requirement', 'Project', 'ProjectStage', 'KeyItem', 'Task', 'Bug'] },
  { title: '合同与付款', objects: ['ProjectContract', 'PaymentStage', 'PaymentRecord'] },
  { title: '持续运维', objects: ['MaintenanceContract', 'WorkOrder'] },
  { title: '参与主体', objects: ['Supplier', 'Person'] }
];
const views = [{ key: 'business', title: '业务定义' }, { key: 'relations', title: '关系说明' }, { key: 'checks', title: '属性与检查' }];
export function BusinessOntologyPage() {
  const userId = useAuthStore(state => state.user?.id);
  const [params, setParams] = useSearchParams();
  const query = useQuery({ queryKey: ['business-ontology', userId], queryFn: ({ signal }) => getBusinessOntology(signal) });
  const model = query.data;
  const selected = model?.classes.find(c => c.id === params.get('object')) || model?.classes.find(c => c.id === 'Product');
  const view = views.some(item => item.key === params.get('view')) ? params.get('view')! : 'business';
  const select = (object: string) => setParams({ object }, { replace: true });
  const changeView = (key: string) => setParams({ object: selected?.id || 'Product', view: key }, { replace: true });
  const showRelation = (id: string) => { setParams({ object: selected?.id || 'Product', view: 'relations', open: id, focus: id }, { replace: true }); document.getElementById('bo-explanation')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };
  const links = model?.relations.flatMap(r => r.from.flatMap(source => r.to.map(target => ({ ...r, source, target })))).filter(r => r.source === selected?.id || r.target === selected?.id) || [];
  const expanded = expandedRelationKeys(params, links);
  const activeRelation = view === 'relations' && expanded.includes(params.get('focus') || '') ? params.get('focus')! : '';
  const setExpanded = (keys: string[], focus = keys.includes(activeRelation) ? activeRelation : '') => setParams({ object: selected?.id || 'Product', view: 'relations', open: keys, ...(focus ? { focus } : {}) }, { replace: true });
  const label = (id: string) => model?.classes.find(c => c.id === id)?.label || id;
  const b = selected?.business;
  const attributeOrder = new Map(selected?.attributes.map((attribute, index) => [attribute.label, index]));
  const orderedChecks = [...(selected?.checks || [])].sort((a, b) =>
    (attributeOrder.get(a.label) ?? attributeOrder.size) - (attributeOrder.get(b.label) ?? attributeOrder.size)
  );
  return <div className="bo-page"><TemplateDetailPage title="业务本体" titleCode={model ? <span className="bo-heading-info"><AdminPopover trigger="click" placement="bottomLeft" title="业务本体说明" content={<div className="bo-page-description"><p>统一业务对象、关联关系、属性状态和检查要求。</p><p>这里查看业务定义；真实业务当前的情况和变化在数字孪生中查看。</p><p>{model.relations.filter(r => !r.inferred).length}种直接关系 · {model.relations.filter(r => r.inferred).length}种推导关系</p></div>}><AdminIconAction label="查看业务本体说明" icon={<QuestionCircleOutlined />}/></AdminPopover><span className="bo-counts">v{model.version} · {model.classes.length}类对象 · {model.relations.length}种关系</span></span> : undefined} loading={query.isPending} error={query.error instanceof Error ? query.error.message : undefined} onRetry={() => { void query.refetch(); }}>
    {model && selected && b ? <>
      <nav className="bo-object-directory" aria-label="业务对象">
        {objectGroups.map(group => <div className="bo-object-group" key={group.title}>
          <span className="bo-object-group-title">{group.title}</span>
          <div className="bo-object-options">{group.objects.flatMap(id => {
            const object = model.classes.find(item => item.id === id);
            return object ? [<AdminButton key={id} size="small" type={selected.id === id ? 'primary' : 'text'} aria-pressed={selected.id === id} onClick={() => select(id)}>{object.label}</AdminButton>] : [];
          })}</div>
        </div>)}
      </nav>
      <AdminSplitPane className="bo-workspace" defaultLeftWidth={700} minLeftWidth={560} minRightWidth={350} storageKey="business-ontology" left={<TemplateDetailSection title={selected.label + '的关系'} extra={<div className="bo-legend"><span>直接关系</span><span className="is-derived">推导关系</span></div>}>
        <OntologyGraph selected={selected.id} classes={model.classes} links={links} activeRelation={activeRelation} onSelect={select} onRelation={showRelation}/><p className="bo-hint">点击对象切换关系图；点击连线文字查看关系含义。窄屏可左右滑动查看。</p>
      </TemplateDetailSection>} right={<div id="bo-explanation"><TemplateDetailSection title={selected.label + ' · 业务说明'}>
        <DetailSectionNavigation items={views} activeKey={view} onChange={changeView} sticky={false} ariaLabel="本体说明分类"/>
        <div className="bo-explanation">
          {view === 'business' ? <><div className="bo-definition"><p>{b.meaning}</p><p>{b.connections}</p></div><h3>数量与归属</h3><ul>{b.quantities.map(t => <li key={t}>{t}</li>)}</ul><h3>人员角色</h3>{b.roles.length ? <ul>{b.roles.map(r => <li key={r.role}>{r.role}：{r.meaning}</li>)}</ul> : <p>人员参与通过相关对象的角色表达；此对象未单独定义人员角色关系。</p>}<h3>业务边界</h3><p>{b.boundary}</p><p className="bo-hint">名称和人员变更不会改变对象身份；同名记录也不自动视为同一个对象。</p></> : null}
          {view === 'relations' ? <><div className="bo-relation-toolbar"><p className="bo-hint">共{links.length}条关系，箭头从起点指向终点。</p><div className="bo-relation-actions"><AdminButton size="small" type="text" disabled={expanded.length === links.length} onClick={() => setExpanded(links.map(relationKey))}>全部展开</AdminButton><AdminButton size="small" type="text" disabled={!expanded.length} onClick={() => setExpanded([])}>全部收起</AdminButton></div></div><AdminCollapse activeKey={expanded} onChange={keys => { const next = (Array.isArray(keys) ? keys : [keys]).map(String); setExpanded(next, focusAfterExpansion(expanded, next, activeRelation)); }} items={links.map(r => ({ key: relationKey(r), className: activeRelation === relationKey(r) ? 'bo-relation-selected' : undefined, label: `${label(r.source)} → ${r.label} → ${label(r.target)}${r.inferred ? '（推导）' : ''}`, children: <div className="bo-relation"><h4>这条关系表示</h4><p>{r.meaning}</p><h4>数量与归属</h4><p>{r.quantity}</p><h4>业务边界</h4><p>{r.boundary}</p>{r.proof.length ? <><h4>推导依据</h4>{r.proof.map(t => <p key={t}>{t}</p>)}</> : null}</div> }))}/></> : null}
          {view === 'checks' ? <><h3>关键业务信息</h3><p>{b.attributes}</p>{b.states ? <><h3>状态怎么表达</h3><p>{b.states}</p></> : null}{b.earlyStates.length ? <><h3>需求类型对应的前期状态</h3><ul>{b.earlyStates.map(row => <li key={row[0]}>{row[0]}：{row[1]}</li>)}</ul></> : null}<AdminCollapse items={[{ key: 'attributes', label: `OWL中已有的属性 · ${selected.attributes.length}项`, children: <div className="bo-fields">{selected.attributes.map(a => <div className="bo-attribute" key={a.id}><strong>{a.label}</strong><span>{a.id}</span></div>)}</div> }]}/><h3>数据检查规则 <span className="bo-technical-name">SHACL</span></h3><p className="bo-hint">规定数据要满足哪些要求。这里展示的是检查规则，具体记录是否通过，需要在查询或校验时判断。</p><p className="bo-hint">未列出的业务要求，不能据此认定已经纳入自动检查。</p>{selected.checks.length || selected.rules.length ? <AdminCollapse key={selected.id} items={[
            ...(selected.checks.length ? [{ key: 'field-checks', label: `字段与关联检查 · ${selected.checks.length}项`, children: <><p className="bo-hint">“必须且只能有1项”表示必填且不能多；“最多1项”只限制数量，这条数量规则本身不要求必填。</p><div className="bo-fields">{orderedChecks.map((check, index) => <div key={index}><strong>{check.label}</strong><span>{check.text.replace(/必须有(\d+)项/g, '必须且只能有$1项').replace(/关联对象为/g, '关联对象必须是').replace(/数据类型：/g, '值的类型：').replace(/允许值：/g, '只能使用以下值：')}</span></div>)}</div></> }] : []),
            ...(selected.rules.length ? [{ key: 'business-checks', label: `业务规则检查 · ${selected.rules.length}项`, children: <><p className="bo-hint">检查对象之间的数量、归属，以及状态、金额、日期等业务信息是否符合以下规则。</p><ul>{selected.rules.map(t => <li key={t}>{t}</li>)}</ul></> }] : [])
          ]}/> : <AdminEmptyState description="此类对象暂无单独的数据检查规则"/>}</> : null}
        </div>
      </TemplateDetailSection></div>}/>
    </> : !query.isPending && !query.error ? <AdminEmptyState description="暂无本体定义"/> : null}
  </TemplateDetailPage></div>;
}
