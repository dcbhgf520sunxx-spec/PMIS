import type { WorkOrderHistoryItem, WorkOrderProblemType, WorkOrderRecord, WorkOrderStatus, WorkOrderUrgency } from './types';

const problemTypes: WorkOrderProblemType[] = ['1', '2', '3', '4', '5'];
const urgencies: WorkOrderUrgency[] = [2, 1, 0];
const statuses: WorkOrderStatus[] = [0, 1, 2, 3, 4, 5];
const followers = [
  { id: '1', employeeNo: 'A001', name: '管理员' },
  { id: '2', employeeNo: 'A002', name: '运维人员' },
  { id: '3', employeeNo: 'A003', name: '审核人员' }
];

const problems = [
  '生产环境登录偶发超时，需要排查认证链路和网关日志',
  '知识库同步任务失败，部分文件停留在解析中',
  '报表导出耗时过长，需要优化查询条件和分页策略',
  '角色权限调整后菜单未及时刷新',
  '基础档案导入后存在重复编码，需要合并处理'
];

const systems = ['生产环境登录系统', '知识库服务', '报表平台', '权限中心', '基础档案平台'];
const productIds = ['1', '2', '3', '4', '5'];

export const mockWorkOrders: WorkOrderRecord[] = Array.from({ length: 56 }, (_, index) => {
  const status = statuses[index % statuses.length];
  const urgency = urgencies[index % urgencies.length];
  const follower = followers[index % followers.length];
  const expectedDay = (index % 20) + 1;
  const isOverdue = ![2, 3].includes(status) && expectedDay < 15;

  return {
    id: String(index + 1),
    code: `RQ-20260630-${String(index + 1).padStart(3, '0')}`,
    productId: productIds[index % productIds.length],
    productName: systems[index % systems.length],
    problemDesc: problems[index % problems.length],
    problemType: problemTypes[index % problemTypes.length],
    problemTypeName: ['日常操作', '系统优化', '故障报障', '后台维护', '其他'][index % 5],
    followerId: follower.id,
    followerName: follower.name,
    urgency,
    status,
    isOverdue,
    expectedResolveDate: `2026-06-${String(expectedDay).padStart(2, '0')}`,
    submitterName: ['张三', '李四', '王五', '赵六'][index % 4],
    submitterDept: ['运维部', '产品部', '财务部', '客服中心'][index % 4],
    submitTime: `2026-06-${String((index % 25) + 1).padStart(2, '0')} 09:30`,
    resolveDate: [2, 3].includes(status) ? `2026-06-${String(Math.min(expectedDay + 1, 28)).padStart(2, '0')}` : undefined,
    closeDate: status === 3 ? `2026-06-${String(Math.min(expectedDay + 2, 28)).padStart(2, '0')}` : undefined,
    suspendDate: status === 4 ? `2026-06-${String(Math.min(expectedDay + 1, 28)).padStart(2, '0')}` : undefined,
    resultDesc: [2, 3].includes(status) ? '已完成日志排查、配置修正和回归验证。' : undefined,
    creatorName: ['管理员', '运维人员'][index % 2],
    createdAt: `2026-06-${String((index % 25) + 1).padStart(2, '0')} 10:00`,
    updaterName: index % 2 === 0 ? '管理员' : '运维人员',
    updatedAt: `2026-06-${String((index % 25) + 2).padStart(2, '0')} 15:20`
  };
});

export const mockWorkOrderHistory: WorkOrderHistoryItem[] = [
  {
    id: 'h1',
    operator: '运维人员',
    action: '状态流转',
    time: '2026-06-30 15:20',
    remark: '开始处理并补充排查记录。',
    changes: [
      { field: '状态', before: '待处理', after: '处理中' },
      { field: '跟进人', before: '管理员', after: '运维人员' }
    ]
  },
  {
    id: 'h2',
    operator: '管理员',
    action: '新增',
    time: '2026-06-30 10:00',
    remark: '创建运维工单。'
  }
];

export const workOrderUsers = followers.map((item) => ({
  label: `${item.employeeNo}·${item.name}`,
  value: item.id
}));
