import { App } from 'antd';

export function useAdminFeedback() {
  const { message, notification, modal } = App.useApp();

  return { message, notification, modal };
}
