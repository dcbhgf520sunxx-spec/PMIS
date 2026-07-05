import { Suspense } from 'react';
import { Spin } from 'antd';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { routes } from './routes';

const router = createBrowserRouter(routes);

export function AppRouter() {
  return (
    <Suspense
      fallback={
        <div className="app-route-loading">
          <Spin />
        </div>
      }
    >
      <RouterProvider router={router} />
    </Suspense>
  );
}
