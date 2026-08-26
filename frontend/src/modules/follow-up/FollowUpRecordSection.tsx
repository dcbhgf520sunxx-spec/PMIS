import { ActivityTimeline, AdminDeleteIconAction, TemplateDetailSection } from '../../components/admin';
import { deleteFollowUpRecord, type FollowUpRecord, type FollowUpTargetType } from '../../api/followUpRecordApi';
import { FollowUpRecordAction } from './FollowUpRecordAction';

type Props = {
  target: { type: FollowUpTargetType; id: string; name: string };
  records: FollowUpRecord[];
  onChanged: () => Promise<void> | void;
};

export function FollowUpRecordSection({ target, records, onChanged }: Props) {
  return (
    <TemplateDetailSection
      title="跟进记录"
      inlineExtraPlacement="after-title"
      inlineExtra={<FollowUpRecordAction target={target} onSaved={onChanged} />}
    >
      <ActivityTimeline
        emptyDescription="暂无跟进记录"
        items={records.map((record) => ({
          id: record.id,
          title: record.creatorName,
          time: record.createdAt,
          description: record.content,
          meta: record.updatedAt !== record.createdAt
            ? `由 ${record.updaterName} 修改于 ${record.updatedAt}`
            : undefined,
          extra: (
            <>
              <FollowUpRecordAction target={target} record={record} variant="icon" onSaved={onChanged} />
              <AdminDeleteIconAction
                entityName="跟进记录"
                title="删除跟进记录"
                successMessage="跟进记录删除成功"
                onConfirm={async () => {
                  await deleteFollowUpRecord(target.type, target.id, record.id);
                  await onChanged();
                }}
              />
            </>
          )
        }))}
      />
    </TemplateDetailSection>
  );
}
