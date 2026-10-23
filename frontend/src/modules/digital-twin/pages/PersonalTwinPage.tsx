import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ProColumns } from '@ant-design/pro-components';
import dayjs from 'dayjs';
import { FileTextOutlined, ProjectOutlined, CheckSquareOutlined, AppstoreOutlined } from '@ant-design/icons';
import { getUserOptions } from '../../../api/userApi';
import { getPersonalTwinSnapshot } from '../../../api/digitalTwinApi';
import { AdminInput, AdminRangePicker, AdminSelect, AdminTag, CategoryTag, defineCategoryToneMap, StatusTag, OverdueTag, AdminTextAction, appendReturnTo, TemplateDetailPage, TemplateDetailSection, TemplateDetailTableSection, ViewTabs } from '../../../components/admin';
import { useAuthStore } from '../../../stores/authStore';
import { TwinGraph } from '../components/TwinGraph';
import { TwinAiSummary } from '../components/TwinAiSummary';
import { renderTwinRecordStatus } from '../components/recordStatus';
import { renderTwinRecordPriority, priorityFieldLabel } from '../components/recordPriority';
import { filterPersonalPeriodRecords } from '../components/personalView';
import { sortPersonalPeriodDetails, personalDetailKind, personalDetailCreatedDate, personalRecordParent } from '../components/personalDetailOrder';
import { kindNames, type PersonalTwinRecord } from '../types';

const parentKindTones = defineCategoryToneMap({products:'violet',requirements:'blue',projects:'indigo',daily:'cyan'});
const parentKindNames: Record<string,string> = {...kindNames,daily:'日常任务'};
const parentIcons: Record<string, ReactNode> = {products:<AppstoreOutlined/>,requirements:<FileTextOutlined/>,projects:<ProjectOutlined/>,daily:<CheckSquareOutlined/>};
const resultNames = { completed: '已完成', unfinished: '未完成', unknown: '待核实', excluded: '不计入' };
const basisNames: Record<string,string> = {planned_in_period:'本期计划',carried_over:'期初遗留',created_in_period:'本期新增',activated_in_period:'本期激活',open_at_start:'期初未关闭'};
export function PersonalTwinPage({ navigation }: { navigation: ReactNode }) {
    const user = useAuthStore(state => state.user);
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const root = useRef<HTMLDivElement>(null);
    const restored = useRef('');
    const [rangeError,setRangeError] = useState('');
    const personId = params.get('person') || String(user?.id || '');
    const today = dayjs(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
    const range = {startDate:params.get('startDate') || today.startOf('month').format('YYYY-MM-DD'),endDate:params.get('endDate') || today.endOf('month').format('YYYY-MM-DD')};
    const people = useQuery({ queryKey:['digital-twin','people',user?.id],queryFn:getUserOptions });
    const query = useQuery({queryKey:['digital-twin','personal',user?.id,personId,range.startDate,range.endDate],queryFn:({signal})=>getPersonalTwinSnapshot(signal,personId,range),enabled:Boolean(personId),refetchInterval:60000});
    const data = query.data;
    const role = ['responsible','participating','collaborating'].includes(params.get('role') || '') ? params.get('role')! : 'responsible';
    const focus = ['completed','unfinished','unknown','excluded'].includes(params.get('focus') || '') ? params.get('focus')! : 'all';
    const defaultKind = personalDetailKind(null,data?.groups || []);
    const kind = personalDetailKind(params.get('kind'),data?.groups || []);
    const attention = ['overdue','high','due'].includes(params.get('attention') || '') ? params.get('attention')! : 'all';
    const search = params.get('search') || '';
    const view = {role,focus,kind,attention,search};
    const rows = sortPersonalPeriodDetails(filterPersonalPeriodRecords(data?.records || [],view,data?.excludedRecords || []),focus);
    const baseRows = filterPersonalPeriodRecords(data?.records || [],{...view,focus:'all'});
    const counts = {all:baseRows.length,completed:baseRows.filter(r=>r.statisticStatus==='completed').length,unfinished:baseRows.filter(r=>r.statisticStatus==='unfinished').length,unknown:baseRows.filter(r=>r.statisticStatus==='unknown').length};
    const node = params.get('node') || 'person';
    const requestedSize = Number(params.get('pageSize'));
    const pageSize = [6,12,24].includes(requestedSize) ? requestedSize : 6;
    const requestedPage=Number(params.get('page'));
    const page = Math.min(Number.isSafeInteger(requestedPage)&&requestedPage>0?requestedPage:1,Math.max(1,Math.ceil(rows.length/pageSize)));
    const historical = Boolean(data && data.period.observationDate<data.period.today);
    const update = (patch:Record<string,string|null>)=>setParams(previous=>{
        const next = new URLSearchParams(previous);
        next.set('view','personal'); next.delete('scroll');
        for(const [key,value] of Object.entries(patch)) {if(value===null)next.delete(key);else next.set(key,value);}
        return next;
    },{replace:true});
    const select = (kindValue=defaultKind,focusValue='all',roleValue='responsible',attentionValue='all')=>{
        update({kind:kindValue,focus:focusValue,role:roleValue,attention:attentionValue,search:null,page:'1',node:data?.nodes.find(n=>n.kind===kindValue)?.key || 'person'});
        requestAnimationFrame(()=>root.current?.querySelector('[data-detail-section-key="chain-detail"]')?.scrollIntoView({block:'start',behavior:'smooth'}));
    };
    const changePerson = (value:string)=>setParams({view:'personal',person:value,...range},{replace:true});
    const source = ()=>{
        const next = new URLSearchParams(params);next.set('view','personal');next.set('person',personId);next.set('startDate',range.startDate);next.set('endDate',range.endDate);
        next.set('kind',kind);
        next.set('scroll',String(Math.round(root.current?.querySelector('.admin-template-detail-page')?.scrollTop || 0)));
        return `/digital-twin?${next}`;
    };
    const openDetail = (row:PersonalTwinRecord)=>{const back=source();navigate(back,{replace:true});navigate(appendReturnTo(row.url,back));};
    useEffect(()=>{
        if(!data || restored.current===params.toString())return;
        const scroll=Number(params.get('scroll'));if(!(scroll>0))return;
        const frame=requestAnimationFrame(()=>{root.current?.querySelector('.admin-template-detail-page')?.scrollTo({top:scroll});restored.current=params.toString();});
        return ()=>cancelAnimationFrame(frame);
    },[data,params]);
    useEffect(()=>{
        if(!data?.groups.some(group=>group.available) || params.get('kind')===kind)return;
        setParams(previous=>{const next=new URLSearchParams(previous);next.set('kind',kind);next.set('page','1');return next;},{replace:true});
    },[data,kind,params,setParams]);
    const columns:ProColumns<PersonalTwinRecord>[] = [
        {title:<span title="任务、缺陷先按业务归属，工单先按产品；全部／未完成按计划日期倒序，缺陷按新增日期倒序；已完成按完成／结论日期倒序，无日期置后；关键事项沿用项目计划原序，不按完成情况排序">工作事项</span>,dataIndex:'name',width:285,fixed:'left',render:(_,row)=>{const priority=renderTwinRecordPriority(row);return <div className="rb-record-cell">{priority?<span className="rb-work-priority" title={`当前${priorityFieldLabel(row.kind)}`}>{priority}</span>:null}<AdminTextAction className="rb-record-title" href={appendReturnTo(row.url,source())} title={`${row.name} · ${row.isSubtask?'子任务 · ':''}编号 ${row.code}`} onClick={event=>{if(!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){event.preventDefault();openDetail(row);}}}>{row.name}</AdminTextAction>{row.isOverdue?<span className="rb-work-overdue"><OverdueTag overdueDays={Math.max(1,dayjs(data?.period.observationDate).diff(dayjs(row.dueDate),'day'))}/></span>:null}</div>;}},
        {title:'业务归属',dataIndex:'parentName',width:220,render:(_,row)=>{const parent=personalRecordParent(row);return <div className="rb-affiliation-cell" title={parent.kind?`${parentKindNames[parent.kind]}${parent.name?`：${parent.name}`:''}`:parent.name}>{parent.kind?<CategoryTag className="rb-affiliation-kind" tone={parentKindTones[parent.kind]} icon={parentIcons[parent.kind]}>{parentKindNames[parent.kind]}</CategoryTag>:null}{parent.name?<span className="rb-affiliation-name">{parent.name}</span>:null}</div>;}},
        {title:historical?'期末状态':'业务状态',dataIndex:'status',width:145,render:(_,row)=><div className="rb-period-status" title={`${row.relationshipLabel}；${row.statisticStatus?resultNames[row.statisticStatus]:''}；${basisNames[row.periodBasis]||''}；${row.statisticReason}`}>{renderTwinRecordStatus(row)}{row.statisticStatus==='unknown'?<StatusTag status="pending" text="待核实"/>:null}</div>},
        {title:<span title="有计划时显示计划完成日期；无计划时标明新增日期">计划／新增</span>,dataIndex:'dueDate',width:110,render:(_,row)=>row.dueDate||<span className="rb-detail-created-date" title="无计划日期，按新增时间排列"><small>新增</small>{personalDetailCreatedDate(row)}</span>},
        {title:'完成／结论',dataIndex:'completionDate',width:110,ellipsis:true,render:(_,row)=>row.completionDate||'—'}
    ];
    const weekStart = today.subtract((today.day()+6)%7,'day');
    const quarterStart = today.month(Math.floor(today.month()/3)*3).startOf('month');
    const presets = [
        {label:'本周',value:[weekStart,weekStart.add(6,'day')] as [dayjs.Dayjs,dayjs.Dayjs]},
        {label:'上周',value:[weekStart.subtract(7,'day'),weekStart.subtract(1,'day')] as [dayjs.Dayjs,dayjs.Dayjs]},
        {label:'本月',value:[today.startOf('month'),today.endOf('month')] as [dayjs.Dayjs,dayjs.Dayjs]},
        {label:'上月',value:[today.subtract(1,'month').startOf('month'),today.subtract(1,'month').endOf('month')] as [dayjs.Dayjs,dayjs.Dayjs]},
        {label:'本季度',value:[quarterStart,quarterStart.add(2,'month').endOf('month')] as [dayjs.Dayjs,dayjs.Dayjs]},
        {label:'本年',value:[today.startOf('year'),today.endOf('year')] as [dayjs.Dayjs,dayjs.Dayjs]}
    ];
    return <div ref={root} id="rb-twin" className="rb-personal" aria-label="个人数字孪生"><TemplateDetailPage title={`${data?.person.name || '人员'} · 工作全景`} titleCode={<span className="rb-context">{data?`本期负责 ${data.overview.responsible} 项 · 参与／协作 ${data.overview.participating} 项`: '按人员与区间查看工作'}</span>} titleCenter={<div className="rb-view-controls"><div className="rb-person-period"><span>时间范围</span><AdminRangePicker aria-label="个人统计时间范围" allowClear={false} value={[dayjs(range.startDate),dayjs(range.endDate)]} presets={presets} status={rangeError?'error':undefined} onChange={dates=>{if(!dates?.[0]||!dates[1])return;if(dates[0].isAfter(today,'day')){setRangeError('不能选择完全在未来的区间');return;}setRangeError('');update({startDate:dates[0].format('YYYY-MM-DD'),endDate:dates[1].format('YYYY-MM-DD'),page:'1',recordId:null,scroll:null});}}/>{rangeError?<span role="alert">{rangeError}</span>:null}</div><div className="rb-person-controls"><span>人员</span><AdminSelect aria-label="工作全景人员" value={personId||undefined} options={people.data||[]} loading={people.isPending} showSearch optionFilterProp="label" allowClear={false} onChange={value=>changePerson(String(value))}/></div>{navigation}</div>} loading={query.isPending} error={query.error instanceof Error?query.error.message:undefined} onRetry={()=>{void query.refetch();}}>
        {data?<>
            <TemplateDetailSection title="个人工作简报" sectionKey="brief" extra={<span className="rb-period-cutoff">统计截至 {data.period.observationDate}　</span>}>
                <div className="rb-person-brief"><TwinAiSummary personal personId={personId} range={range} productId="personal" userId={user?.id} updates={data.attention} sourceRevision={data.summaryRevision} onSync={()=>query.refetch()}/></div>
            </TemplateDetailSection>
            <TemplateDetailSection title="本期工作概览" sectionKey="landscape">
                <TwinGraph personal nodes={data.nodes} completions={Object.fromEntries(data.groups.map(g=>[g.key,g.completion]))} selected={node} view="all" focus={attention==='high'?'attention':''} onSelect={key=>select(data.nodes.find(n=>n.key===key)?.kind==='person'?defaultKind:data.nodes.find(n=>n.key===key)?.kind||defaultKind)} onFocus={key=>select(data.nodes.find(n=>n.key===key)?.kind||defaultKind,'all','responsible','high')} onPeriodFilter={(key,filter)=>select(data.nodes.find(n=>n.key===key)?.kind||defaultKind,['participating','collaborating'].includes(filter)?'all':filter==='overdue'?'unfinished':filter,['participating','collaborating'].includes(filter)?filter:'responsible',filter==='overdue'?'overdue':'all')}/>
                <div className="rb-period-rule"><div className="rb-period-rule-copy"><span>完成率＝本期已完成／本期纳入；本期纳入含本期计划及期初逾期未完成工作。</span><span>按当前负责人、最新计划归期，主子任务按个人去重；参与／协作单列，不计完成率。历史区间截至期末，证据不足标记待核实。</span></div><AdminTextAction onClick={()=>select(kind,'excluded')}>统计口径与排除明细</AdminTextAction></div>
            </TemplateDetailSection>
            <TemplateDetailTableSection<PersonalTwinRecord> title="工作明细" sectionKey="chain-detail" summary={focus==='unknown'||focus==='excluded'?<AdminTag>{focus==='unknown'?'待核实':'排除明细'}</AdminTag>:undefined} extra={<div className="rb-period-table-controls">
                {role==='responsible'&&focus!=='excluded'?<ViewTabs showCounts value={focus} onChange={value=>update({focus:value,page:'1'})} items={[{label:'全部',value:'all',count:counts.all},{label:'已完成',value:'completed',count:counts.completed},{label:'未完成',value:'unfinished',count:counts.unfinished}]}/>:null}
                <AdminSelect style={{width:130}} aria-label="个人工作类别" value={kind} allowClear={false} options={data.groups.filter(g=>g.available).map(g=>({value:g.kind,label:g.title}))} onChange={value=>update({kind:String(value),node:data.nodes.find(n=>n.kind===value)?.key||'person',page:'1'})}/>
                <AdminSelect style={{width:100}} aria-label="个人工作关系" value={role} allowClear={false} options={[{value:'responsible',label:'负责'},{value:'participating',label:'参与'},{value:'collaborating',label:'协作'}]} onChange={value=>update({role:String(value),focus:'all',page:'1'})}/>
                <AdminSelect style={{width:140}} aria-label="关注标记" value={attention} allowClear={false} options={[{value:'all',label:'全部关注标记'},{value:'high',label:'高优／紧急'},{value:'overdue',label:'逾期'},{value:'due',label:'本期剩余到期'}]} onChange={value=>update({attention:String(value),page:'1'})}/>
                <AdminInput aria-label="搜索工作名称" placeholder="搜索名称、编号或归属" value={search} allowClear onChange={event=>update({search:event.target.value||null,page:'1'})}/>
                {role==='responsible'&&counts.unknown?<AdminTextAction onClick={()=>update({focus:'unknown',page:'1'})}>待核实 {counts.unknown} 项</AdminTextAction>:null}
                {kind!==defaultKind||role!=='responsible'||focus!=='all'||attention!=='all'||search?<AdminTextAction onClick={()=>select()}>清除筛选</AdminTextAction>:null}
            </div>} table={{columns,rowKey:row=>`${row.kind}:${row.id}`,dataSource:rows.slice((page-1)*pageSize,page*pageSize),scroll:{x:870},tableLayout:'fixed'}} pagination={{current:page,pageSize,pageSizeOptions:[6,12,24],total:rows.length,onChange:(current,size)=>update({page:String(size===pageSize?current:1),pageSize:String(size)})}}/>
        </>:null}
    </TemplateDetailPage></div>;
}
