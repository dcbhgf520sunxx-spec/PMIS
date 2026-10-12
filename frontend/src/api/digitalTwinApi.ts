import { request, unwrap } from './requestClient';
import { arrayContract, objectContract } from './responseContract';
import type { TwinProduct, TwinSnapshot, TwinRecord, TwinNode, TwinGroup, TwinLink, TwinAiSummary } from '../modules/digital-twin/types';
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
