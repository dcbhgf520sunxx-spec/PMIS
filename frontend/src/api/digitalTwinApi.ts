import { request, unwrap } from './requestClient';
import { arrayContract, objectContract } from './responseContract';
import type { TwinProduct, TwinSnapshot, TwinRecord, TwinNode, TwinGroup, TwinLink, TwinAiSummary, PersonalTwinSnapshot, PersonalTwinRecord, PersonalTwinEvent } from '../modules/digital-twin/types';
const productContract = objectContract<TwinProduct>(['id', 'name', 'owner']);
const groupContract = objectContract<TwinGroup>(['key', 'title', 'kind', 'available', 'metrics', 'note', 'rows', 'explanation'], { metrics: arrayContract(objectContract(['label', 'value', 'unit'])), rows: arrayContract(objectContract(['label', 'value'])) });
const nodeContract = objectContract<TwinNode>(['key', 'title', 'kind', 'available', 'value', 'unit', 'note', 'priorityAlerts'], { priorityAlerts: arrayContract(objectContract(['level', 'label', 'count', 'detail'])) });
const recordContract = objectContract<TwinRecord>(['kind', 'id', 'name', 'code', 'status', 'statusCode', 'priorityCode', 'needsAttention', 'owner', 'value', 'parentName', 'chain', 'description', 'dueDate', 'updatedAt', 'url'], { chain: arrayContract(objectContract<TwinLink>(['kind', 'id', 'name'])) });
const snapshotContract = objectContract<TwinSnapshot>(['product', 'asOf', 'groups', 'nodes', 'records', 'attention'], { product: productContract, groups: arrayContract(groupContract), nodes: arrayContract(nodeContract), records: arrayContract(recordContract), attention: arrayContract(recordContract) });
export async function getTwinProducts(signal?: AbortSignal) {
    const rows = await unwrap(request.get('/digital-twin/products', { signal }), arrayContract(productContract));
    return rows.map(row => ({ ...row, id: String(row.id) }));
}
export async function getTwinSnapshot(productId: string, signal?: AbortSignal): Promise<TwinSnapshot> {
    const data = await unwrap(request.get(`/digital-twin/${encodeURIComponent(productId)}`, { signal }), snapshotContract);
    const convert = (row: TwinRecord): TwinRecord => ({ ...row, id: String(row.id), chain: row.chain.map(link => ({ ...link, id: String(link.id) })) });
    return { ...data, product: { ...data.product, id: String(data.product.id) }, records: data.records.map(convert), attention: data.attention.map(convert) };
}
export async function getTwinAiSummary(productId: string, signal?: AbortSignal, force = false): Promise<TwinAiSummary> {
    return unwrap(request.post(`/digital-twin/${encodeURIComponent(productId)}/summary`, { force }, { signal, timeout: 75000 }),
        objectContract<TwinAiSummary>(['text', 'model', 'provider', 'generatedAt', 'sourceAsOf', 'updatedCount', 'sourceRevision']));
}
const personalRecordContract = objectContract<PersonalTwinRecord>(['kind', 'id', 'name', 'code', 'status', 'statusCode', 'priorityCode', 'needsAttention', 'owner', 'value', 'parentName', 'chain', 'description', 'dueDate', 'updatedAt', 'url', 'relationship', 'relationshipLabel', 'productName', 'productId', 'createdAt', 'isSubtask', 'isOpen', 'parentClosed', 'isOverdue', 'dueSoon', 'workState', 'nextAction', 'progressNote', 'included', 'completed', 'statisticStatus', 'statisticReason', 'periodBasis', 'completionDate', 'periodRelevant', 'hasPeriodActivity'], { chain: arrayContract(objectContract<TwinLink>(['kind', 'id', 'name'])) });
const personalSnapshotContract = objectContract<PersonalTwinSnapshot>(['person', 'asOf', 'overview', 'groups', 'nodes', 'records', 'attention', 'priorities', 'events', 'workBoard', 'summaryRevision', 'period', 'excludedRecords'], {
    period: objectContract(['startDate','endDate','observationDate','today']), excludedRecords: arrayContract(personalRecordContract), person: objectContract(['id', 'name']), overview: objectContract(['responsible', 'participating', 'open', 'urgent', 'overdue', 'dueSoon', 'products']),
    groups: arrayContract(objectContract(['key','title','kind','available','metrics','note','rows','explanation','completion'], {completion:objectContract(['included','completed','knownIncluded','knownCompleted','unfinished','unknown','rate','carried','participating','collaborating','excluded'])})), nodes: arrayContract(nodeContract), records: arrayContract(personalRecordContract), attention: arrayContract(personalRecordContract), priorities: arrayContract(personalRecordContract),
    workBoard: objectContract(['current', 'next'], { current: arrayContract(personalRecordContract), next: arrayContract(personalRecordContract) }),
    events: arrayContract(objectContract<PersonalTwinEvent>(['id', 'kind', 'recordId', 'name', 'action', 'createdAt', 'url']))
});
export async function getPersonalTwinSnapshot(signal?: AbortSignal, personId?: string, range?: { startDate: string; endDate: string }): Promise<PersonalTwinSnapshot> {
    return unwrap(request.get('/digital-twin/personal', { signal, params: { personId, ...range } }), personalSnapshotContract);
}
const personalSummaryItems = arrayContract(objectContract(['sourceIds','text','productId','productName','projectId','topic']));
export async function getPersonalTwinAiSummary(signal?: AbortSignal, force = false, personId?: string, range?: { startDate: string; endDate: string }): Promise<TwinAiSummary> {
    return unwrap(request.post('/digital-twin/personal/summary', { force }, { signal, timeout: 240000, params: { personId, ...range } }), objectContract<TwinAiSummary>(['text', 'model', 'provider', 'generatedAt', 'sourceAsOf', 'updatedCount', 'sourceRevision','sections'], {sections:objectContract(['progress','priorities','concerns'],{progress:personalSummaryItems,priorities:personalSummaryItems,concerns:personalSummaryItems})}));
}
