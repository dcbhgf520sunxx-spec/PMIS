export type TwinProduct = {
    id: string;
    name: string;
    owner: string;
};
export type TwinGroup = {
    key: string;
    title: string;
    kind: string;
    available: boolean;
    metrics: {
        label: string;
        value: string;
        unit: string;
    }[];
    note: string;
    rows: {
        label: string;
        value: string;
    }[];
    explanation: string;
};
export type TwinFocusLevel = 'high' | 'critical';
export type TwinFocus = TwinFocusLevel | 'attention';
export type TwinNode = {
    periodStats?: { unfinished: number; overdue: number; unknown: number };
    key: string;
    title: string;
    kind: string;
    available: boolean;
    value: string;
    unit: string;
    note: string;
    priorityAlerts: { level: TwinFocusLevel; label: string; count: number; detail: string }[];
};
export type TwinLink = {
    kind: string;
    id: string;
    name: string;
};
export type TwinRecord = Record<string, unknown> & {
    kind: string;
    id: string;
    name: string;
    code: string;
    status: string;
    statusCode: number | string | null;
    priorityCode: number | null;
    needsAttention: boolean;
    owner: string;
    value: string;
    parentName: string;
    chain: TwinLink[];
    description: string;
    dueDate: string;
    updatedAt: string;
    url: string;
};
export type TwinSnapshot = {
    product: TwinProduct;
    asOf: string;
    groups: TwinGroup[];
    nodes: TwinNode[];
    records: TwinRecord[];
    attention: TwinRecord[];
};
export type TwinAiSummary = {
    sections?: Record<'progress' | 'priorities' | 'concerns', { sourceIds: string[]; text: string; productId?: string; productName?: string; projectId?: string; topic?: string }[]>;
    coveredCount?: number;
    provider: string;
    text: string;
    model: string;
    generatedAt: string;
    sourceAsOf: string;
    updatedCount: number;
    sourceRevision: string;
};
export type PersonalPeriod = { startDate: string; endDate: string; observationDate: string; today: string };
export type PersonalCompletion = { included: number | null; completed: number | null; knownIncluded: number; knownCompleted: number; unfinished: number; unknown: number; rate: number | null; carried: number; participating: number; collaborating: number; excluded: number };
export type PersonalTwinGroup = TwinGroup & { completion: PersonalCompletion };
export type PersonalTwinRecord = TwinRecord & {
    included: boolean | null;
    completed: boolean | null;
    statisticStatus: 'completed' | 'unfinished' | 'unknown' | 'excluded';
    statisticReason: string;
    periodBasis: string;
    completionDate: string;
    periodRelevant: boolean;
    hasPeriodActivity: boolean;
    relationship: 'responsible' | 'participant' | 'collaborator';
    relationshipLabel: string;
    productName: string;
    productId: string;
    createdAt: string;
    isSubtask: boolean;
    isOpen: boolean;
    parentClosed: boolean;
    isOverdue: boolean;
    dueSoon: boolean;
    workState: 'active' | 'pending' | 'waiting' | 'ended';
    nextAction: string;
    progressNote: string;
};
export type PersonalTwinEvent = { id: string; kind: string; recordId: string; name: string; action: string; createdAt: string; url: string };
export type PersonalTwinSnapshot = {
    period: PersonalPeriod;
    excludedRecords: PersonalTwinRecord[];
    person: { id: string; name: string };
    asOf: string;
    overview: { responsible: number; participating: number; open: number; urgent: number; overdue: number; dueSoon: number; products: number };
    groups: PersonalTwinGroup[];
    nodes: TwinNode[];
    records: PersonalTwinRecord[];
    attention: PersonalTwinRecord[];
    priorities: PersonalTwinRecord[];
    workBoard: { current: PersonalTwinRecord[]; next: PersonalTwinRecord[] };
    events: PersonalTwinEvent[];
    summaryRevision: string;
};
// 与侧栏菜单顺序一致，子对象紧跟所属业务模块；更新分类和对象选项共用此顺序。
export const kindNames: Record<string, string> = { products: '产品', maintenance: '维保合同', requirements: '需求', projects: '项目', planStages: '项目阶段', planItems: '关键事项', contracts: '项目合同', paymentStages: '付款阶段', payments: '付款记录', tasks: '任务', bugs: '缺陷', orders: '工单' };
