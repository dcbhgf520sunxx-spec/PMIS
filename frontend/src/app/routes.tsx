import { lazy, Suspense, type ReactNode } from 'react';
import { Spin } from 'antd';
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

function withRouteSuspense(element: ReactNode) {
  return (
    <Suspense fallback={<div className="app-route-loading"><Spin /></div>}>
      {element}
    </Suspense>
  );
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
const ProductListPage = lazy(() => import('../modules/product/pages/ProductListPage').then((module) => ({ default: module.ProductListPage })));
const ProductFormPage = lazy(() => import('../modules/product/pages/ProductFormPage').then((module) => ({ default: module.ProductFormPage })));
const ProductDetailPage = lazy(() => import('../modules/product/pages/ProductDetailPage').then((module) => ({ default: module.ProductDetailPage })));
const ProjectListPage = lazy(() => import('../modules/project/pages/ProjectListPage').then((module) => ({ default: module.ProjectListPage })));
const ProjectFormPage = lazy(() => import('../modules/project/pages/ProjectFormPage').then((module) => ({ default: module.ProjectFormPage })));
const ProjectDetailPage = lazy(() => import('../modules/project/pages/ProjectDetailPage').then((module) => ({ default: module.ProjectDetailPage })));

export const routes: RouteObject[] = [
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
      { path: 'home', element: withRouteSuspense(<HomePage />) },
      { path: 'products', element: withRouteSuspense(<ProductListPage />) },
      { path: 'products/new', element: withRouteSuspense(<ProductFormPage mode="create" />) },
      { path: 'products/:id/edit', element: withRouteSuspense(<ProductFormPage mode="edit" />) },
      { path: 'products/:id', element: withRouteSuspense(<ProductDetailPage />) },
      { path: 'projects', element: withRouteSuspense(<ProjectListPage />) },
      { path: 'projects/new', element: withRouteSuspense(<ProjectFormPage mode="create" />) },
      { path: 'projects/:id/edit', element: withRouteSuspense(<ProjectFormPage mode="edit" />) },
      { path: 'projects/:id', element: withRouteSuspense(<ProjectDetailPage />) },
      { path: 'roles', element: withRouteSuspense(<RoleListPage />) },
      { path: 'roles/new', element: withRouteSuspense(<RoleFormPage mode="create" />) },
      { path: 'roles/:id/edit', element: withRouteSuspense(<RoleFormPage mode="edit" />) },
      { path: 'roles/:id', element: withRouteSuspense(<RoleDetailPage />) },
      { path: 'archive', element: withRouteSuspense(<ArchivePage />) },
      { path: 'access-logs', element: withRouteSuspense(<AccessLogListPage />) },
      { path: 'work-orders', element: withRouteSuspense(<WorkOrderListPage />) },
      { path: 'work-orders/new', element: withRouteSuspense(<WorkOrderFormPage mode="create" />) },
      { path: 'work-orders/:id/copy', element: withRouteSuspense(<WorkOrderFormPage mode="copy" />) },
      { path: 'work-orders/:id/edit', element: withRouteSuspense(<WorkOrderFormPage mode="edit" />) },
      { path: 'work-orders/:id', element: withRouteSuspense(<WorkOrderDetailPage />) },
      { path: 'samples/work-order', element: withRouteSuspense(<WorkOrderTemplatePage />) },
      { path: 'samples/work-order/new', element: withRouteSuspense(<WorkOrderTemplateFormPage mode="create" />) },
      { path: 'samples/work-order/:id/copy', element: withRouteSuspense(<WorkOrderTemplateFormPage mode="copy" />) },
      { path: 'samples/work-order/:id/edit', element: withRouteSuspense(<WorkOrderTemplateFormPage mode="edit" />) },
      { path: 'samples/work-order/:id', element: withRouteSuspense(<WorkOrderTemplateDetailPage />) },
      { path: 'system/design-system', element: withRouteSuspense(<DesignSystemPage />) },
      { path: 'users', element: withRouteSuspense(<UserListPage />) },
      { path: 'users/new', element: withRouteSuspense(<UserFormPage mode="create" />) },
      { path: 'users/:id/edit', element: withRouteSuspense(<UserFormPage mode="edit" />) },
      { path: 'users/:id', element: withRouteSuspense(<UserDetailPage />) }
    ]
  }
];
