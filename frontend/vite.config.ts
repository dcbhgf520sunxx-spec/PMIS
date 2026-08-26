import { execFileSync } from 'node:child_process';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function resolveGitCommit(envValue?: string) {
  if (envValue?.trim()) return envValue.trim();
  try {
    return execFileSync('git', ['rev-parse', '--short=8', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'development';
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(env.VITE_DEV_PORT || 3104);
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3103';
  const gitCommit = resolveGitCommit(env.VITE_GIT_COMMIT);
  const buildTime = env.VITE_BUILD_TIME || new Date().toISOString();

  return {
    plugins: [react()],
    define: {
      __APP_GIT_COMMIT__: JSON.stringify(gitCommit),
      __APP_BUILD_TIME__: JSON.stringify(buildTime)
    },
    build: {
      chunkSizeWarningLimit: 900,
      rolldownOptions: {
        output: {
          strictExecutionOrder: true,
          codeSplitting: {
            groups: [
              {
                name: 'react-vendor',
                test: /node_modules[\\/](?:react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
                priority: 100
              },
              {
                name: 'pro-core-vendor',
                test: /node_modules[\\/]@ant-design[\\/]pro-(?:field|provider|utils)[\\/]/,
                priority: 80
              },
              {
                name: 'pro-table-vendor',
                test: /node_modules[\\/]@ant-design[\\/]pro-table[\\/]/,
                priority: 70
              },
              {
                name: 'pro-layout-vendor',
                test: /node_modules[\\/]@ant-design[\\/]pro-layout[\\/]/,
                priority: 70
              },
              {
                name: 'pro-support-vendor',
                test: /node_modules[\\/]@ant-design[\\/]pro-(?:card|list|descriptions|skeleton)[\\/]/,
                priority: 70
              },
              {
                name: 'antd-vendor',
                test: /node_modules[\\/]antd[\\/]/,
                priority: 90
              },
              {
                name: 'ant-design-vendor',
                test: /node_modules[\\/]@ant-design[\\/](?!pro-)[^\\/]+[\\/]/,
                priority: 95
              },
              {
                name: 'rc-vendor',
                test: /node_modules[\\/](?:@rc-component[\\/][^\\/]+|rc-[^\\/]+)[\\/]/,
                priority: 95
              },
              {
                name: 'charts-vendor',
                test: /node_modules[\\/](?:echarts|zrender)[\\/]/,
                priority: 50
              }
            ]
          }
        }
      }
    },
    server: {
      host: '0.0.0.0',
      port,
      strictPort: true,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true
        },
        '/uploads': {
          target: proxyTarget,
          changeOrigin: true
        }
      }
    }
  };
});
