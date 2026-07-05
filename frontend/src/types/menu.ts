export type MenuItem = {
  id: number;
  parent_id?: number;
  name: string;
  code: string;
  path?: string;
  icon?: string;
  sort_order?: number;
  children?: MenuItem[];
};
