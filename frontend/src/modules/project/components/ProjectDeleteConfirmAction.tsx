import { Form } from 'antd';
import { ApiError } from '../../../api/apiError';
import { DeleteConfirmAction } from '../../../components/admin';
import { deleteProject } from '../../../api/projectApi';
import { RequirementReleaseFields, type RequirementReleaseValues } from '../../requirement/components/RequirementReleaseFields';
import type { ProjectRecord } from '../types';
export function ProjectDeleteConfirmAction({ project, variant, onDeleted }: { project: ProjectRecord; variant?: 'text'; onDeleted: () => void | Promise<void> }) {
  const [form] = Form.useForm<RequirementReleaseValues>();
  return <DeleteConfirmAction permission="project" variant={variant} entityName="项目" targetName={project.name} successMessage="删除成功" description={project.requirementId ? <><p>删除项目“{project.name}”，并将原需求“{project.requirementName}”恢复到所选状态。</p><Form form={form} layout="vertical"><RequirementReleaseFields requirementType={project.requirementType!} /></Form></> : undefined} onConfirm={async () => {
    const values = project.requirementId ? await form.validateFields() : undefined;
    try { await deleteProject(project.id, values); } catch (error) {
      if (error instanceof ApiError && error.fieldErrors?.requirement_release) {
        const errorFields = [{ name: 'status' as const, errors: error.fieldErrors.requirement_release }];
        form.setFields(errorFields);
        throw { errorFields };
      }
      throw error;
    }
    form.resetFields();
    await onDeleted();
  }}>删除</DeleteConfirmAction>;
}
