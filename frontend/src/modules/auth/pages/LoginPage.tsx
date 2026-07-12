import { type FormEvent, type MouseEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { derivePermissions, getUserPreference, login } from '../../../api/authApi';
import { useAuthStore } from '../../../stores/authStore';
import robotMini from '../../../assets/login/robot-mini.png';
import './LoginPage.css';

type FocusedField = 'account' | 'password' | null;

type Ripple = {
  id: number;
  x: number;
  y: number;
  size: number;
};

export function LoginPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const setAuth = useAuthStore((state) => state.setAuth);
  const setPreference = useAuthStore((state) => state.setPreference);
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [focusedField, setFocusedField] = useState<FocusedField>(null);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [buttonPressed, setButtonPressed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
    setButtonPressed(true);
    window.setTimeout(() => setButtonPressed(false), 180);

    if (!account.trim()) {
      message.error('工号或手机号不能为空');
      return;
    }
    if (!password) {
      message.error('密码不能为空');
      return;
    }

    setSubmitting(true);
    try {
      const result = await login({
        account: account.trim(),
        password
      });
      setAuth({
        token: result.token,
        user: result.user,
        menus: result.menus,
        permissions: derivePermissions(result.menus),
        accessSessionId: result.access_session_id
      });
      const preference = await getUserPreference();
      setPreference(preference);
      message.success('登录成功');
      navigate(preference.default_route || '/home', { replace: true });
    } catch (error) {
      message.error(error instanceof Error ? error.message : '登录失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
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
          项目管理系统
        </Typography.Title>
        <form autoComplete="on" className="login-form" onSubmit={handleSubmit}>
          <label
            className={`login-field ${focusedField === 'account' ? 'is-focused' : ''}`}
            htmlFor="login-username"
          >
            <Input
              autoComplete="username"
              id="login-username"
              name="username"
              onBlur={() => setFocusedField(null)}
              onChange={(event) => setAccount(event.target.value)}
              onFocus={() => setFocusedField('account')}
              placeholder="请输入账号或手机号"
              prefix={<UserOutlined />}
              value={account}
            />
          </label>
          <label
            className={`login-field ${focusedField === 'password' ? 'is-focused' : ''}`}
            htmlFor="login-password"
          >
            <Input.Password
              autoComplete="current-password"
              id="login-password"
              name="password"
              onBlur={() => setFocusedField(null)}
              onChange={(event) => setPassword(event.target.value)}
              onFocus={() => setFocusedField('password')}
              placeholder="请输入密码"
              prefix={<LockOutlined />}
              value={password}
            />
          </label>
          <Button
            className={`login-submit ${buttonPressed ? 'is-pressed' : ''}`}
            htmlType="submit"
            loading={submitting}
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
  );
}
