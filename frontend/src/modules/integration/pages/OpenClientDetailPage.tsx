import {useEffect,useState} from 'react';
import {App} from 'antd';
import {useParams} from 'react-router-dom';
import {AdminAlert,AdminButton,AdminFormItem,AdminModal,AdminTextArea,ConfirmAction,DetailMetaList,StatusConfirmAction,StatusTag,TemplateDetailPage,TemplateDetailSection,usePageReturnNavigation} from '../../../components/admin';
import {getOpenClient,resetOpenClientCredential,setOpenClientStatus,type OpenClient} from '../../../api/openClientApi';

export function OpenClientDetailPage() {
  const {id = ''} = useParams();
  const nav = usePageReturnNavigation('/integrations');
  const {message} = App.useApp();
  const [row,setRow] = useState<OpenClient>();
  const [credential,setCredential] = useState('');
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [revision,setRevision] = useState(0);
  useEffect(() => {
    let live = true;setLoading(true);setError('');setCredential('');
    getOpenClient(id).then((r) => {
      if (!live) return;
      setRow(r);
    }).catch((e:Error) => {if (live) setError(e.message);}).finally(() => {if (live) setLoading(false);});
    return () => {live = false;};
  },[id,revision]);
  const endpoint = `${window.location.origin}/api/open/v1`;
  const manualUrl = `${window.location.origin}/docs/sidm-open-api.html`;
  return <><TemplateDetailPage title="接入系统详情" titleCode={row?.code} loading={loading} error={error} onRetry={() => setRevision((v) => v+1)} onBack={nav.returnToSource}
    actions={row ? <><AdminButton onClick={() => nav.navigateWithReturn(`/integrations/clients/${id}/requests`)}>调用历史</AdminButton><ConfirmAction title="生成或重置接入凭证？" description="旧凭证将立即失效，正在使用它的外部系统需要更新配置。新凭证仅本次展示，请及时安全保存。" successMessage={false} onConfirm={async () => {const r = await resetOpenClientCredential(id);setCredential(r.credential);}}>生成/重置凭证</ConfirmAction><AdminButton type="primary" onClick={() => nav.navigateWithReturn(`/integrations/clients/${id}/edit`)}>编辑</AdminButton></> : null}
    statusSection={row ? {items:[{label:'状态',value:<StatusTag status={row.enabled ? 'enabled' : 'disabled'} />}]} : null}
    statusAction={row ? <StatusConfirmAction block type="primary" entityName="接入系统" targetName={row.name} action={row.enabled ? 'disable' : 'enable'} onConfirm={async () => {await setOpenClientStatus(id,row.enabled ? 0 : 1);setRevision((v) => v+1);}}>{row.enabled ? '停用' : '启用'}</StatusConfirmAction> : null}
    documentSection={row ? {items:[{label:'创建人',value:row.creatorName},{label:'创建时间',value:row.createdAt},{label:'更新人',value:row.updaterName},{label:'更新时间',value:row.updatedAt}]} : null}>
    {row ? <><TemplateDetailSection title="基本信息"><DetailMetaList items={[
      {label:'系统编码',value:row.code},{label:'系统名称',value:row.name},{label:'凭证有效期',value:row.expiresAt ? row.expiresAt.slice(0,19).replace('T',' ') : '长期有效'},
    ]} /></TemplateDetailSection>
    <TemplateDetailSection title="接入说明" inlineExtraPlacement="after-title" inlineExtra={<AdminButton type="link" href={manualUrl} target="_blank" rel="noopener noreferrer">查看接口手册</AdminButton>}><DetailMetaList items={[
      {label:'当前环境接口地址',value:endpoint,wide:true},
      {label:'请求头',value:'Authorization: Bearer <接入凭证>\nContent-Type: application/json\n将 <接入凭证> 整段替换为实际凭证，Bearer 后保留一个空格；凭证不拼进接口地址。',wide:true,longText:true},
      {label:'凭证获取',value:'通过右上角“生成/重置凭证”获取，仅展示一次，请单独安全交付，勿放入手册或链接。',wide:true,longText:true},
      {label:'操作人要求',value:'业务请求须传实际操作人工号 operatorEmployeeNo，并遵守该人员现有业务权限。',wide:true,longText:true},
    ]} /></TemplateDetailSection></> : null}
  </TemplateDetailPage>
  <AdminModal title="接入凭证（仅本次展示）" open={Boolean(credential)} onCancel={() => setCredential('')} onOk={() => setCredential('')} okText="已保存，关闭" cancelButtonProps={{style:{display:'none'}}} destroyOnHidden>
    <AdminAlert type="warning" showIcon message="关闭后无法再次查看，请安全保存。旧凭证已失效。" />
    <AdminFormItem label="接入凭证"><AdminTextArea aria-label="接入凭证" readOnly value={credential} rows={3} /></AdminFormItem>
    <AdminButton onClick={async () => {try {await navigator.clipboard.writeText(credential);message.success('已复制');} catch {message.error('复制失败，请选中文本手动复制');}}}>复制凭证</AdminButton>
  </AdminModal>
  </>;
}
