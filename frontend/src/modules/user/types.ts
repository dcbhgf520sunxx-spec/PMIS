export type UserRecord = Record<string, unknown> & {
  id: string;
  employeeNo: string;
  realName: string;
  phone?: string;
  roleIds?: string[];
  roles?: Array<{ id: string; name: string }>;
  roleName: string;
  status: 'enabled' | 'disabled';
  creatorName?: string;
  updaterName?: string;
  createdAt: string;
  updatedAt?: string;
};

export type UserFormValues = Record<string, unknown> & {
  employeeNo: string;
  realName: string;
  phone?: string;
  roleIds: string[];
  password?: string;
};

export type HrPerson = {
  employeeNo: string;
  realName: string;
  phone?: string;
};
