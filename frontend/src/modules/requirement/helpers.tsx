import { OverdueTag, PriorityTag } from '../../components/admin';
import type { RequirementPriority } from './types';
export function renderRequirementPriority(priority:RequirementPriority){return <PriorityTag level={priority===2?'high':priority===1?'medium':'low'} text={['低','中','高'][priority]}/>}
export function renderRequirementOverdue(isOverdue:boolean,expectedEndDate?:string){if(!isOverdue)return <OverdueTag overdueDays={0}/>;const due=new Date(expectedEndDate||'');const days=Number.isNaN(due.getTime())?1:Math.max(1,Math.ceil((Date.now()-due.getTime())/86_400_000));return <OverdueTag overdueDays={days}/>}
