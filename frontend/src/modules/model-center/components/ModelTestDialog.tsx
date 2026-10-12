import { useQuery } from '@tanstack/react-query';
import { AdminAsyncTaskStatus, AdminModal } from '../../../components/admin';
import { testModelConnection } from '../../../api/modelConnectionApi';
export function ModelTestDialog({ id, onClose }: { id: string; onClose: () => void }) {
    const query = useQuery({ queryKey: ['model-test', id], queryFn: ({signal}) => testModelConnection(id,signal), enabled: Boolean(id), retry: false, staleTime: 0, refetchOnWindowFocus: false });
    return <AdminModal title="测试模型连接" open={Boolean(id)} onCancel={onClose} onOk={onClose} okText="关闭" cancelButtonProps={{style:{display:'none'}}} destroyOnHidden>
        {query.isFetching || query.isPending ? <AdminAsyncTaskStatus state="running" title="正在测试连接"/> : query.isError ? <AdminAsyncTaskStatus state="error" title="连接测试失败" errorMessage={query.error.message === 'Network Error' ? '网络连接失败，请稍后重试' : query.error.message} onRetry={() => { void query.refetch(); }}/> : <AdminAsyncTaskStatus state="success" title="连接成功" description={`${query.data.model} · 耗时 ${(query.data.elapsedMs / 1000).toFixed(1)} 秒`}/>}
    </AdminModal>;
}
