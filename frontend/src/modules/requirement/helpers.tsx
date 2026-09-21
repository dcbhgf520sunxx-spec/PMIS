import { OverdueTag, PriorityTag } from '../../components/admin';
import type { RequirementPriority } from './types';
export function renderRequirementPriority(priority:RequirementPriority){return <PriorityTag level={priority===2?'high':priority===1?'medium':'low'} text={['低','中','高'][priority]}/>}
export function renderRequirementOverdue(isOverdue:boolean,expectedEndDate?:string){
  if(!isOverdue)return <OverdueTag overdueDays={0}/>;
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const date=Object.fromEntries(parts.map(({type,value})=>[type,value]));
  const today=Date.UTC(Number(date.year),Number(date.month)-1,Number(date.day));
  const due=Date.parse(expectedEndDate||'');
  const days=Number.isNaN(due)?1:Math.max(1,Math.round((today-due)/86_400_000));
  return <OverdueTag overdueDays={days}/>;
}
