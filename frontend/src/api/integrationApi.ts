import { request, unwrap } from './requestClient';
import { arrayContract, objectContract } from './responseContract';

export type IntegrationConfig = {
  id: number; code: string; name: string; adapter_code: string; endpoint_url: string; request_method: string;
  enabled: number; auto_enabled: number; sync_interval_hours: number; initial_sync_date: string;
  auto_start_at?: string;
  last_started_at?: string; last_finished_at?: string; last_status: string; last_total_count: number;
  last_success_count: number; last_failure_count: number; last_warning_count: number; last_error?: string;
};
export type IntegrationExecution = { id: number; trigger_type?: 'auto' | 'manual'; status: string; error_message?: string; result_data?: Record<string, unknown> | string; started_at?: string; finished_at?: string };
export type IntegrationSyncRecord = { id: number; source_key: string; source_type: string; target_type?: string; target_id?: number; sync_status: string; execution_action_code?: string; execution_action?: string; processing_note?: string; target_priority?: number; warning_message?: string; error_message?: string; synced_at?: string };
type Page<T> = { list: T[]; total: number; page: number; pageSize: number };

const configContract = objectContract<IntegrationConfig>(['id','code','name','adapter_code','endpoint_url','request_method','enabled','auto_enabled','sync_interval_hours','initial_sync_date','last_status','last_total_count','last_success_count','last_failure_count','last_warning_count']);
const executionContract = objectContract<IntegrationExecution>(['id','status']);
const recordContract = objectContract<IntegrationSyncRecord>(['id','source_key','source_type','sync_status']);
const pageContract = <T>(item: (value: unknown) => value is T) => objectContract<Page<T>>(['list','total','page','pageSize'], { list: arrayContract(item) });
const emptyContract = (value: unknown): value is null => value === null;
const connectionContract = objectContract<{ connected: boolean; recordCount: number; window: { start: string; end: string } }>(['connected','recordCount','window'], { window: objectContract(['start','end']) });
const syncContract = objectContract<{ total: number; success: number; skipped: number; failed: number; warnings: number }>(['total','success','skipped','failed','warnings']);

export const listIntegrations = () => unwrap<IntegrationConfig[]>(request.get('/integrations'), arrayContract(configContract));
export const updateIntegration = (id: number, values: Pick<IntegrationConfig,'name'|'endpoint_url'|'auto_enabled'|'sync_interval_hours'|'auto_start_at'>) => unwrap<null>(request.put(`/integrations/${id}`, values), emptyContract);
export const changeIntegrationStatus = (id: number, enabled: 0 | 1) => unwrap<null>(request.patch(`/integrations/${id}/status`, { enabled }), emptyContract);
export const testIntegrationConnection = (id: number) => unwrap(request.post(`/integrations/${id}/test`, undefined, { timeout: 35000 }), connectionContract);
export const runIntegrationSync = (id: number) => unwrap(
  request.post(`/integrations/${id}/sync`, undefined, { timeout: 120000 }),
  syncContract,
);
export const listIntegrationExecutions = (id: number, page = 1, pageSize = 20) => unwrap<Page<IntegrationExecution>>(request.get(`/integrations/${id}/executions`, { params: { page, pageSize } }), pageContract(executionContract));
export const listIntegrationRecords = (id: number, executionId: number, page = 1, pageSize = 50) => unwrap<Page<IntegrationSyncRecord>>(request.get(`/integrations/${id}/executions/${executionId}/records`, { params: { page, pageSize } }), pageContract(recordContract));
