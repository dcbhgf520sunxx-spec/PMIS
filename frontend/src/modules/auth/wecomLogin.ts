const WECOM_ERROR_MESSAGES: Record<string, string> = {
  account_not_found: '账号尚未开通，请联系管理员',
  account_disabled: '账号已停用，请联系管理员',
  invalid_state: '企微登录验证已失效，请从企微工作台重新进入',
  missing_code: '企微未返回登录授权，请从企微工作台重新进入'
};

export type WecomLoginQuery = {
  ticket?: string;
  errorMessage?: string;
};

export function parseWecomLoginSearch(search: string): WecomLoginQuery {
  const params = new URLSearchParams(search);
  const errorCode = params.get('wecom_error')?.trim();
  if (errorCode) {
    return {
      errorMessage: WECOM_ERROR_MESSAGES[errorCode] || '企微登录失败，请从企微工作台重新进入'
    };
  }

  const ticket = params.get('wecom_ticket')?.trim();
  return ticket ? { ticket } : {};
}
