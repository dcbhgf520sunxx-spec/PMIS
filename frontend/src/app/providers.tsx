import type { ReactNode } from 'react';
import { useEffect, useMemo } from 'react';
import { App as AntApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { ProConfigProvider } from '@ant-design/pro-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { createAdminTheme } from '../styles/theme';

dayjs.locale('zh-cn');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

export function AppProviders({ children }: { children: ReactNode }) {
  const theme = useMemo(() => createAdminTheme('light'), []);

  useEffect(() => {
    document.documentElement.dataset.appearance = 'light';
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={zhCN} theme={theme}>
        <ProConfigProvider hashed={false}>
          <AntApp>{children}</AntApp>
        </ProConfigProvider>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
