import { type FormEvent, type MouseEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App, Button, Card, Input, Typography } from 'antd';
import {
  ApartmentOutlined,
  FieldTimeOutlined,
  InteractionOutlined,
  LockOutlined,
  NodeIndexOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  UserOutlined
} from '@ant-design/icons';
import { logoutAccessSession } from '../../../api/accessLogApi';
import { derivePermissions, exchangeWecomTicket, getLoginCaptcha, getUserPreference, login, type LoginCaptcha } from '../../../api/authApi';
import { ApiError } from '../../../api/apiError';
import { PasswordChangeModal } from '../../account/components/PasswordChangeModal';
import { useAuthStore } from '../../../stores/authStore';
import robotMini from '../../../assets/login/robot-mini.png';
import { parseWecomLoginSearch } from '../wecomLogin';
import './LoginPage.css';

type FocusedField = 'account' | 'password' | 'captcha' | null;

type Ripple = {
  id: number;
  x: number;
  y: number;
  size: number;
};

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = App.useApp();
  const setAuth = useAuthStore((state) => state.setAuth);
  const setPreference = useAuthStore((state) => state.setPreference);
  const mustChangePassword = useAuthStore((state) => state.mustChangePassword);
  const setMustChangePassword = useAuthStore((state) => state.setMustChangePassword);
  const accessSessionId = useAuthStore((state) => state.accessSessionId);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState<LoginCaptcha | null>(null);
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaLoading, setCaptchaLoading] = useState(true);
  const [captchaLoadError, setCaptchaLoadError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const captchaRequest = useRef(0);
  const submitInFlight = useRef(false);
  const [focusedField, setFocusedField] = useState<FocusedField>(null);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [buttonPressed, setButtonPressed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const handledWecomQuery = useRef('');

  const refreshCaptcha = useCallback(async () => {
    const requestId = ++captchaRequest.current;
    setCaptcha(null);
    setCaptchaCode('');
    setCaptchaLoading(true);
    setCaptchaLoadError('');
    try {
      const result = await getLoginCaptcha();
      if (requestId === captchaRequest.current) setCaptcha(result);
    } catch (error) {
      if (requestId === captchaRequest.current) {
        setCaptchaLoadError(error instanceof Error ? error.message : '验证码加载失败，请重试');
      }
    } finally {
      if (requestId === captchaRequest.current) setCaptchaLoading(false);
    }
  }, []);

  useEffect(() => {
    const requestCounter = captchaRequest;
    void refreshCaptcha();
    return () => { requestCounter.current++; };
  }, [refreshCaptcha]);

  const enterPreferredPage = useCallback(async () => {
    const preference = await getUserPreference();
    setPreference(preference);
    message.success('登录成功');
    navigate(preference.default_route || '/home', { replace: true });
  }, [message, navigate, setPreference]);

  useEffect(() => {
    const query = parseWecomLoginSearch(location.search);
    const queryKey = query.ticket ? `ticket:${query.ticket}` : query.errorMessage ? `error:${location.search}` : '';
    if (!queryKey || handledWecomQuery.current === queryKey) return;
    handledWecomQuery.current = queryKey;

    if (query.errorMessage) {
      message.error(query.errorMessage);
      navigate('/login', { replace: true });
      return;
    }

    setSubmitting(true);
    exchangeWecomTicket(query.ticket as string)
      .then(async (result) => {
        setAuth({
          token: result.token,
          user: result.user,
          menus: result.menus,
          permissions: derivePermissions(result.menus),
          accessSessionId: result.access_session_id,
          mustChangePassword: false
        });
        await enterPreferredPage();
      })
      .catch((error) => {
        message.error(error instanceof Error ? error.message : '企微登录失败');
        navigate('/login', { replace: true });
      })
      .finally(() => setSubmitting(false));
  }, [enterPreferredPage, location.search, message, navigate, setAuth]);

  const handleForcedPasswordExit = () => {
    const token = useAuthStore.getState().token;
    void logoutAccessSession(accessSessionId, { token }).catch(() => {
      message.warning('退出请求未完成，已清除本地登录状态');
    });
    clearAuth();
    setAccount('');
    setPassword('');
    setFieldErrors({});
    void refreshCaptcha();
    navigate('/login', { replace: true });
  };

  const createRipple = (event: MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.7;
    const id = Date.now();
    setRipples((items) => [
      ...items,
      {
        id,
        x: event.clientX - rect.left - size / 2,
        y: event.clientY - rect.top - size / 2,
        size
      }
    ]);
    window.setTimeout(() => {
      setRipples((items) => items.filter((item) => item.id !== id));
    }, 760);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitInFlight.current || submitting) return;
    setButtonPressed(true);
    window.setTimeout(() => setButtonPressed(false), 180);

    const errors: Record<string, string> = {};
    if (!account.trim()) errors.account = '请输入账号或手机号';
    if (!password) errors.password = '请输入密码';
    if (!captchaCode.trim()) errors.captcha_code = '请输入验证码';
    setFieldErrors(errors);
    if (Object.keys(errors).length || !captcha || captchaLoading) return;

    submitInFlight.current = true;
    setSubmitting(true);
    try {
      const result = await login({
        account: account.trim(),
        password,
        captcha_id: captcha.captcha_id,
        captcha_code: captchaCode.trim()
      });
      const firstLogin = result.first_login === 1;
      setAuth({
        token: result.token,
        user: result.user,
        menus: result.menus,
        permissions: derivePermissions(result.menus),
        accessSessionId: result.access_session_id,
        mustChangePassword: firstLogin
      });
      if (firstLogin) {
        message.warning('首次登录，请先修改密码');
        return;
      }
      await enterPreferredPage();
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors?.captcha_code?.length) {
        setFieldErrors({ captcha_code: error.fieldErrors.captcha_code[0] });
      } else {
        message.error(error instanceof Error ? error.message : '登录失败');
      }
      void refreshCaptcha();
    } finally {
      submitInFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <>
      <section className="login-page">
      <div className="login-intro" aria-hidden="true">
        <div className="login-hero-headline">
          <div className="login-hero-robot">
            <img src={robotMini} alt="" />
          </div>
          <Typography.Title className="login-hero-title" level={1}>
            不怕事情多，就怕没着落
          </Typography.Title>
        </div>
        <p className="login-hero-copy">
          该排的安排，该推进的推进，该解决的别躲着。项目自然越走越顺。
        </p>
        <div className="login-signal-grid">
          <span>
            <InteractionOutlined />
            产品规划
          </span>
          <span>
            <NodeIndexOutlined />
            项目推进
          </span>
          <span>
            <ApartmentOutlined />
            交付闭环
          </span>
        </div>
      </div>
      <Card className="login-card" onMouseDown={createRipple}>
        <div className="login-ripple-layer" aria-hidden="true">
          {ripples.map((ripple) => (
            <span
              className="login-ripple"
              key={ripple.id}
              style={{
                height: ripple.size,
                left: ripple.x,
                top: ripple.y,
                width: ripple.size
              }}
            />
          ))}
        </div>
        <div className="login-card-header">
          <span className="login-card-badge">
            <SafetyCertificateOutlined />
            安全登录
          </span>
        </div>
        <Typography.Title className="login-title" level={3}>
          <span className="login-title-text">智能数管</span>
          <span className="login-title-code">SIDM</span>
        </Typography.Title>
        <form autoComplete="on" className="login-form" onSubmit={handleSubmit}>
          <div>
          <label
            className={`login-field ${focusedField === 'account' ? 'is-focused' : ''}`}
            htmlFor="login-username"
          >
            <Input
              autoComplete="username"
              id="login-username"
              name="username"
              onBlur={() => setFocusedField(null)}
              onChange={(event) => {
                setAccount(event.target.value);
                setFieldErrors((errors) => ({ ...errors, account: '' }));
              }}
              onFocus={() => setFocusedField('account')}
              placeholder="请输入账号或手机号"
              prefix={<UserOutlined />}
              value={account}
              aria-label="账号或手机号"
              aria-invalid={Boolean(fieldErrors.account)}
              aria-describedby={fieldErrors.account ? 'login-account-error' : undefined}
            />
          </label>
          {fieldErrors.account && <div className="login-field-error" id="login-account-error" role="alert">{fieldErrors.account}</div>}
          </div>
          <div>
          <label
            className={`login-field ${focusedField === 'password' ? 'is-focused' : ''}`}
            htmlFor="login-password"
          >
            <Input.Password
              autoComplete="current-password"
              id="login-password"
              name="password"
              onBlur={() => setFocusedField(null)}
              onChange={(event) => {
                setPassword(event.target.value);
                setFieldErrors((errors) => ({ ...errors, password: '' }));
              }}
              onFocus={() => setFocusedField('password')}
              placeholder="请输入密码"
              prefix={<LockOutlined />}
              value={password}
              aria-label="密码"
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
            />
          </label>
          {fieldErrors.password && <div className="login-field-error" id="login-password-error" role="alert">{fieldErrors.password}</div>}
          </div>
          <div>
            <div className="login-captcha-row">
              <div className={`login-field ${focusedField === 'captcha' ? 'is-focused' : ''}`}>
                <Input
                  id="login-captcha"
                  name="captcha_code"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={5}
                  aria-label="验证码"
                  aria-invalid={Boolean(fieldErrors.captcha_code)}
                  aria-describedby="login-captcha-help"
                  placeholder="请输入验证码"
                  prefix={<SafetyCertificateOutlined />}
                  value={captchaCode}
                  disabled={captchaLoading || !captcha || submitting}
                  onChange={(event) => {
                    setCaptchaCode(event.target.value);
                    setFieldErrors((errors) => ({ ...errors, captcha_code: '' }));
                  }}
                  onFocus={() => setFocusedField('captcha')}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
              <Button
                className="login-captcha-image"
                htmlType="button"
                aria-label={captchaLoadError ? '重试验证码' : '刷新验证码'}
                title="点击更换验证码"
                loading={captchaLoading}
                disabled={submitting || captchaLoading}
                onClick={() => { void refreshCaptcha(); }}
              >
                {captcha ? <img src={captcha.image} alt="图形验证码" /> : captchaLoading ? '加载中' : '点击重试'}
              </Button>
            </div>
            <div id="login-captcha-help" className={fieldErrors.captcha_code || captchaLoadError ? 'login-field-error' : 'login-captcha-help'} aria-live="polite">
              {fieldErrors.captcha_code || captchaLoadError || '不区分大小写，点击图片可换一张'}
            </div>
          </div>
          <Button
            className={`login-submit ${buttonPressed ? 'is-pressed' : ''}`}
            htmlType="submit"
            loading={submitting}
            disabled={captchaLoading || !captcha}
            type="primary"
          >
            登录系统
          </Button>
        </form>
        <div className="login-trust-row" aria-hidden="true">
          <span>
            <ThunderboltOutlined />
            协同推进
          </span>
          <span>
            <FieldTimeOutlined />
            全程留痕
          </span>
        </div>
      </Card>
      </section>
      <PasswordChangeModal
        open={mustChangePassword}
        forced
        onCancel={handleForcedPasswordExit}
        onSuccess={() => {
          setMustChangePassword(false);
          void enterPreferredPage();
        }}
      />
    </>
  );
}
