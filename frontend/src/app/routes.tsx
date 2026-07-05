import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { AdminLayout } from '../layouts/AdminLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { LoginPage } from '../modules/auth/pages/LoginPage';
import { useAuthStore } from '../stores/authStore';

function DefaultEntryRedirect() {
  const defaultRoute = useAuthStore((state) => state.preference.default_route);
  return <Navigate to={defaultRoute || '/home'} replace />;
}

const HomePage = lazy(() =>
  import('../modules/home/pages/HomePage').then((module) => ({
    default: module.HomePage
  }))
);
const DesignSystemPage = lazy(() =>
  import('../modules/design-system/pages/DesignSystemPage').then((module) => ({
    default: module.DesignSystemPage
  }))
);
const UserListPage = lazy(() =>
  import('../modules/user/pages/UserListPage').then((module) => ({
    default: module.UserListPage
  }))
);
const RoleListPage = lazy(() =>
  import('../modules/role/pages/RoleListPage').then((module) => ({
    default: module.RoleListPage
  }))
);
const RoleFormPage = lazy(() =>
  import('../modules/role/pages/RoleFormPage').then((module) => ({
    default: module.RoleFormPage
  }))
);
const RoleDetailPage = lazy(() =>
  import('../modules/role/pages/RoleDetailPage').then((module) => ({
    default: module.RoleDetailPage
  }))
);
const UserFormPage = lazy(() =>
  import('../modules/user/pages/UserFormPage').then((module) => ({
    default: module.UserFormPage
  }))
);
const UserDetailPage = lazy(() =>
  import('../modules/user/pages/UserDetailPage').then((module) => ({
    default: module.UserDetailPage
  }))
);
const WorkOrderListPage = lazy(() =>
  import('../modules/work-order/pages/WorkOrderListPage').then((module) => ({
    default: module.WorkOrderListPage
  }))
);
const WorkOrderFormPage = lazy(() =>
  import('../modules/work-order/pages/WorkOrderFormPage').then((module) => ({
    default: module.WorkOrderFormPage
  }))
);
const WorkOrderDetailPage = lazy(() =>
  import('../modules/work-order/pages/WorkOrderDetailPage').then((module) => ({
    default: module.WorkOrderDetailPage
  }))
);
const WorkOrderTemplatePage = lazy(() =>
  import('../modules/work-order-template/pages/WorkOrderTemplatePage').then((module) => ({
    default: module.WorkOrderTemplatePage
  }))
);
const WorkOrderTemplateFormPage = lazy(() =>
  import('../modules/work-order-template/pages/WorkOrderTemplateFormPage').then((module) => ({
    default: module.WorkOrderTemplateFormPage
  }))
);
const WorkOrderTemplateDetailPage = lazy(() =>
  import('../modules/work-order-template/pages/WorkOrderTemplateDetailPage').then((module) => ({
    default: module.WorkOrderTemplateDetailPage
  }))
);
const ArchivePage = lazy(() =>
  import('../modules/archive/pages/ArchivePage').then((module) => ({
    default: module.ArchivePage
  }))
);
const AccessLogListPage = lazy(() =>
  import('../modules/access-log/pages/AccessLogListPage').then((module) => ({
    default: module.AccessLogListPage
  }))
);
const AiAssistant3DPage = lazy(() =>
  import('../modules/ai-assistant-3d/pages/AiAssistant3DPage').then((module) => ({
    default: module.AiAssistant3DPage
  }))
);

export const routes: RouteObject[] = [
  {
    path: '/ai-assistant-3d',
    element: <AiAssistant3DPage />
  },
  {
    path: '/login',
    element: <AuthLayout />,
    children: [{ index: true, element: <LoginPage /> }]
  },
  {
    path: '/',
    element: <AdminLayout />,
    children: [
      { index: true, element: <DefaultEntryRedirect /> },
      { path: 'home', element: <HomePage /> },
      { path: 'roles', element: <RoleListPage /> },
      { path: 'roles/new', element: <RoleFormPage mode="create" /> },
      { path: 'roles/:id/edit', element: <RoleFormPage mode="edit" /> },
      { path: 'roles/:id', element: <RoleDetailPage /> },
      { path: 'archive', element: <ArchivePage /> },
      { path: 'access-logs', element: <AccessLogListPage /> },
      { path: 'work-orders', element: <WorkOrderListPage /> },
      { path: 'work-orders/new', element: <WorkOrderFormPage mode="create" /> },
      { path: 'work-orders/:id/copy', element: <WorkOrderFormPage mode="copy" /> },
      { path: 'work-orders/:id/edit', element: <WorkOrderFormPage mode="edit" /> },
      { path: 'work-orders/:id', element: <WorkOrderDetailPage /> },
      { path: 'samples/work-order', element: <WorkOrderTemplatePage /> },
      { path: 'samples/work-order/new', element: <WorkOrderTemplateFormPage mode="create" /> },
      { path: 'samples/work-order/:id/copy', element: <WorkOrderTemplateFormPage mode="copy" /> },
      { path: 'samples/work-order/:id/edit', element: <WorkOrderTemplateFormPage mode="edit" /> },
      { path: 'samples/work-order/:id', element: <WorkOrderTemplateDetailPage /> },
      { path: 'system/design-system', element: <DesignSystemPage /> },
      { path: 'users', element: <UserListPage /> },
      { path: 'users/new', element: <UserFormPage mode="create" /> },
      { path: 'users/:id/edit', element: <UserFormPage mode="edit" /> },
      { path: 'users/:id', element: <UserDetailPage /> }
    ]
  }
];
