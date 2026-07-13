const START_TIME_TOLERANCE_MS = 1000;

export function assessBackendRuntimeFreshness({ listenerPid, processStartMs, latestSourceMtimeMs }) {
  if (!listenerPid) {
    return {
      status: 'skipped',
      message: '本地后端未运行，跳过运行态新鲜度检查'
    };
  }

  if (latestSourceMtimeMs > processStartMs + START_TIME_TOLERANCE_MS) {
    return {
      status: 'stale',
      message: '后端源码晚于当前服务启动时间，请重启后端后重新执行门禁'
    };
  }

  return {
    status: 'fresh',
    message: '当前后端服务已加载最新源码'
  };
}
