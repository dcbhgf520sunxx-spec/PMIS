import type { ThemeConfig } from 'antd';
import { theme as antdTheme } from 'antd';

export function createAdminTheme(appearanceMode: 'light' | 'dark'): ThemeConfig {
  const isDark = appearanceMode === 'dark';
  return {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: '#1f6fff',
      colorInfo: '#0ea5e9',
      colorSuccess: '#16a34a',
      colorWarning: '#f59e0b',
      colorError: '#dc2626',
      colorBgLayout: isDark ? '#101827' : '#f4f8fd',
      colorBgContainer: isDark ? '#182235' : '#ffffff',
      colorBorder: isDark ? '#334155' : '#dce8f7',
      colorBorderSecondary: isDark ? '#263447' : '#eaf1fa',
      colorText: isDark ? '#e5edf7' : '#12213a',
      colorTextSecondary: isDark ? '#9fb0c7' : '#64748b',
      borderRadius: 6,
      fontSize: 13,
      controlHeight: 32,
      controlHeightSM: 28,
      controlHeightLG: 36
    },
    components: {
      Button: {
        borderRadius: 6,
        controlHeight: 32,
        primaryShadow: '0 8px 18px rgba(31, 111, 255, 0.18)'
      },
      Card: {
        borderRadiusLG: 8,
        paddingLG: 16,
        colorBorderSecondary: isDark ? '#334155' : '#dce8f7'
      },
      DatePicker: {
        activeBorderColor: '#1f6fff',
        cellRangeBorderColor: '#1f6fff',
        hoverBorderColor: '#1f6fff'
      },
      Form: {
        itemMarginBottom: 16
      },
      Modal: {
        borderRadiusLG: 8
      },
      Table: {
        cellPaddingBlock: 8,
        cellPaddingInline: 10,
        headerBg: isDark ? '#1f2b3d' : '#f5f9ff',
        headerColor: isDark ? '#d8e4f3' : '#25415f',
        rowHoverBg: isDark ? '#213149' : '#f1f7ff',
        borderColor: isDark ? '#2b3a51' : '#e6eef8'
      },
      Menu: {
        itemSelectedBg: isDark ? '#1d3558' : '#eaf3ff',
        itemSelectedColor: '#1f6fff',
        itemHoverBg: isDark ? '#1d2a3d' : '#f5f9ff',
        itemBorderRadius: 8
      },
      Tag: {
        borderRadiusSM: 5
      }
    }
  };
}
