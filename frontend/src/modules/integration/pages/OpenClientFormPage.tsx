import {useEffect,useState} from 'react';
import {App} from 'antd';
import {useParams} from 'react-router-dom';
import dayjs from 'dayjs';
import {AdminAlert,AdminDatePicker,AdminFormItem,AdminProFormText,TemplateFormPage,TemplateFormSection,usePageReturnNavigation} from '../../../components/admin';
import {getOpenClient,saveOpenClient,type ClientValues} from '../../../api/openClientApi';

export function OpenClientFormPage() {
  const {id} = useParams();
  const nav = usePageReturnNavigation('/integrations');
  const {message} = App.useApp();
  const [initial,setInitial] = useState<Record<string,unknown>>();
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [revision,setRevision] = useState(0);
  useEffect(() => {
    let live = true;setLoading(true);setError('');
    (id ? getOpenClient(id) : Promise.resolve(undefined)).then((row) => {
      if (!live) return;
      setInitial(row ? {code:row.code,name:row.name,expiresAt:row.expiresAt ? dayjs(row.expiresAt) : null} : {name:'',expiresAt:null});
    }).catch((e:Error) => {if (live) setError(e.message);}).finally(() => {if (live) setLoading(false);});
    return () => {live = false;};
  },[id,revision]);
  return <TemplateFormPage<ClientValues> title={id ? '编辑接入系统' : '新增接入系统'} formId="open-client-form" initialValues={initial} loading={loading} error={error} onRetry={() => setRevision((v) => v+1)} onCancel={nav.returnToSource}
    onSubmit={async (values) => {await saveOpenClient(id,{name:values.name,expiresAt:values.expiresAt ? dayjs(values.expiresAt).toISOString() : null});message.success(id ? '保存成功' : '新增成功，请在系统详情生成接入凭证');nav.returnToSource();}}>
    <TemplateFormSection title="基本信息"><div className="admin-template-form-page__grid">
      <AdminProFormText name="code" label="系统编码" disabled placeholder="保存后自动生成" />
      <AdminProFormText name="name" label="系统名称" rules={[{required:true,message:'请输入系统名称'},{max:100,message:'最多100字符'}]} />
      <AdminFormItem name="expiresAt" label="凭证有效期至" extra="不填写表示长期有效"><AdminDatePicker showTime format="YYYY-MM-DD HH:mm:ss" /></AdminFormItem>
    </div></TemplateFormSection>
    <TemplateFormSection title="接入说明">
      <AdminAlert type="info" showIcon message="新增系统默认停用；生成凭证后，再从列表或详情启用。" description="有效凭证可调用全部已开放接口，无需逐项授权。业务请求须传实际操作人工号，并遵守该人员现有业务权限。" />
    </TemplateFormSection>
  </TemplateFormPage>;
}
