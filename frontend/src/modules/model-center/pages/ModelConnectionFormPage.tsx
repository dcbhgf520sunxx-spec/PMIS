import { useEffect, useState } from 'react';
import { App } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { AdminAlert, AdminFormItem, AdminNumberInput, AdminPasswordInput, AdminProFormText, TemplateFormPage, TemplateFormSection, usePageReturnNavigation } from '../../../components/admin';
import { getModelConnection, saveModelConnection, type ModelValues } from '../../../api/modelConnectionApi';
export function ModelConnectionFormPage() {
    const { id } = useParams();
    const nav = usePageReturnNavigation('/model-connections');
    const { message } = App.useApp();
    const cache = useQueryClient();
    const [initial,setInitial] = useState<ModelValues>();
    const [loading,setLoading] = useState(true);
    const [error,setError] = useState('');
    const [revision,setRevision] = useState(0);
    useEffect(() => {
        let live = true; setLoading(true); setError('');
        (id ? getModelConnection(id) : Promise.resolve(undefined)).then(row => { if (live) setInitial(row ? {name:row.name,provider:row.provider,baseUrl:row.baseUrl,modelName:row.modelName,timeoutSeconds:row.timeoutSeconds,apiKey:''} : {name:'',provider:'DeepSeek',baseUrl:'https://api.deepseek.com',modelName:'deepseek-flash',timeoutSeconds:30,apiKey:''}); })
            .catch((e: Error) => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); });
        return () => { live = false; };
    },[id,revision]);
    return <TemplateFormPage<ModelValues> title={id ? '编辑模型' : '新增模型'} formId="model-connection-form" initialValues={initial} loading={loading} error={error} onRetry={() => setRevision(value => value+1)} onCancel={nav.returnToSource}
        onSubmit={async values => { await saveModelConnection(id,values); await cache.invalidateQueries({queryKey:['digital-twin','ai-summary']}); message.success('保存成功'); nav.returnToSource(); }}>
        <TemplateFormSection title="模型配置"><div className="admin-template-form-page__grid">
            <AdminProFormText name="name" label="接入名称" rules={[{required:true,message:'请输入接入名称'},{max:100,message:'最多100字符'}]}/>
            <AdminProFormText name="provider" label="供应商" rules={[{required:true,message:'请输入供应商'},{max:100,message:'最多100字符'}]}/>
            <AdminProFormText name="baseUrl" label="服务地址" extra="支持公共HTTPS地址，填写基础地址，如 https://api.deepseek.com；系统使用 Chat Completions 协议。" rules={[{required:true,message:'请输入服务地址'},{max:500,message:'最多500字符'}]}/>
            <AdminProFormText name="modelName" label="模型标识" rules={[{required:true,message:'请输入模型标识'},{max:100,message:'最多100字符'}]}/>
            <AdminFormItem name="apiKey" label="API密钥" extra={id ? '密钥不回显；留空保留原密钥，输入新值替换。' : '密钥加密保存，保存后不再回显。'} rules={id ? [] : [{required:true,message:'请输入API密钥'}]}><AdminPasswordInput autoComplete="new-password" placeholder={id ? '留空保留原密钥' : '请输入API密钥'}/></AdminFormItem>
            <AdminFormItem name="timeoutSeconds" label="请求超时（秒）" rules={[{required:true,message:'请输入请求超时'}]}><AdminNumberInput min={5} max={60} precision={0}/></AdminFormItem>
        </div></TemplateFormSection>
        <TemplateFormSection title="使用说明"><AdminAlert type="info" showIcon message="新增模型默认停用。保存后可测试连接，确认可用后启用并设为默认模型。" description="数字孪生AI总结使用启用的默认模型，设置后立即生效。测试连接使用固定短文本，不发送业务数据。"/></TemplateFormSection>
    </TemplateFormPage>;
}
