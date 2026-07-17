import {
  DownOutlined,
  AppstoreOutlined,
  BugOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  CheckSquareOutlined,
  HomeOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LockOutlined,
  SettingOutlined,
  ProjectOutlined,
  ToolOutlined,
  UserOutlined
} from '@ant-design/icons';
import { App, Avatar, Button, Dropdown, Layout, Menu, Space } from 'antd';
import type { MenuProps } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { heartbeatAccessSession, logoutAccessSession } from '../../api/accessLogApi';
import { getMessages, markAllMessagesRead, markMessageRead, type MessageRecord } from '../../api/messageApi';
import { AdminFloatingAssistant, AdminMessageCenter } from '../../components/admin';
import { AccountDrawers } from '../../modules/account/components/AccountDrawers';
import { designCategoryNavItems, isDesignCategory } from '../../modules/design-system/categories';
import { useAuthStore } from '../../stores/authStore';
import type { MenuItem as UserMenuItem } from '../../types/menu';
import './index.css';

const { Header, Sider, Content } = Layout;
const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const SESSION_IDLE_CHECK_MS = 30 * 1000;
const SESSION_HEARTBEAT_THROTTLE_MS = 60 * 1000;
const SESSION_ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;
const DEFAULT_HEADER_SUBTITLE = '欢迎回来，今天也请从容处理每一项工作。';

type AdminMenuItems = NonNullable<MenuProps['items']>;

const businessMenuItems: AdminMenuItems = [
  {
    key: '/home',
    icon: <HomeOutlined />,
    label: '首页'
  },
  {
    key: '/products',
    icon: <AppstoreOutlined />,
    label: '产品管理'
  },
  {
    key: '/projects',
    icon: <ProjectOutlined />,
    label: '项目管理'
  },
  {
    key: '/requirements',
    icon: <FileTextOutlined />,
    label: '需求管理'
  },
  {
    key: '/tasks',
    icon: <CheckSquareOutlined />,
    label: '任务管理'
  },
  {
    key: '/bugs',
    icon: <BugOutlined />,
    label: 'BUG管理'
  },
  {
    key: '/work-orders',
    icon: <ToolOutlined />,
    label: '运维工单'
  },
  {
    key: 'base_settings',
    icon: <SettingOutlined />,
    label: '基础设置',
    children: [
      {
        key: '/archive',
        label: '基础档案'
      },
      {
        key: '/access-logs',
        label: '访问日志'
      }
    ]
  },
  {
    key: 'user_auth',
    icon: <UserOutlined />,
    label: '用户权限',
    children: [
      {
        key: '/users',
        label: '用户管理'
      },
      {
        key: '/roles',
        label: '角色管理'
      }
    ]
  },
  {
    key: 'design_system',
    icon: <ExperimentOutlined />,
    label: '组件工作台',
    children: [
      ...designCategoryNavItems.slice(0, 1).map((item) => ({
        key: `/system/design-system?category=${item.key}`,
        label: item.label
      })),
      {
        key: '/samples/work-order',
        label: '页面样板'
      },
      ...designCategoryNavItems.slice(1).map((item) => ({
        key: `/system/design-system?category=${item.key}`,
        label: item.label
      }))
    ]
  }
];

const menuItems = businessMenuItems;

function collectAllowedMenuKeys(items: UserMenuItem[]): Set<string> {
  const keys = new Set<string>(['home', '/home']);
  const collect = (menu: UserMenuItem) => {
    if (menu.code) keys.add(menu.code);
    if (menu.path) keys.add(menu.path);
    menu.children?.forEach(collect);
  };

  items.forEach(collect);
  return keys;
}

function collectAllowedMenuPaths(items: UserMenuItem[]): Set<string> {
  const paths = new Set<string>(['/home']);
  const collect = (menu: UserMenuItem) => {
    if (menu.path) paths.add(menu.path);
    menu.children?.forEach(collect);
  };

  items.forEach(collect);
  return paths;
}

function getFirstMenuPath(items: AdminMenuItems): string {
  for (const item of items) {
    if (!item || typeof item !== 'object' || !('key' in item)) continue;

    const key = String(item.key);
    if (key.startsWith('/')) return key;
    if ('children' in item && item.children) {
      const childPath = getFirstMenuPath(item.children as AdminMenuItems);
      if (childPath) return childPath;
    }
  }

  return '/home';
}

function getPermissionLocationKey(pathname: string, search: string) {
  if (pathname === '/system/design-system') {
    const category = new URLSearchParams(search).get('category');
    const selectedCategory = isDesignCategory(category) ? category : 'overview';
    return `/system/design-system?category=${selectedCategory}`;
  }
  return pathname;
}

function isPathAllowed(locationKey: string, allowedPaths: Set<string>): boolean {
  return Array.from(allowedPaths).some((path) => {
    if (path.includes('?') || locationKey.includes('?')) return locationKey === path;
    return locationKey === path || locationKey.startsWith(`${path}/`);
  });
}

function filterMenuItemsByPermissions(items: AdminMenuItems, allowedKeys: Set<string>): AdminMenuItems {
  return items
    .map((item) => {
      if (!item || typeof item !== 'object' || !('key' in item)) return item;

      const key = String(item.key);
      const children = 'children' in item && item.children
        ? filterMenuItemsByPermissions(item.children as AdminMenuItems, allowedKeys)
        : undefined;

      if (allowedKeys.has(key) || (children && children.length > 0)) {
        return children ? { ...item, children } : item;
      }

      return null;
    })
    .filter(Boolean) as AdminMenuItems;
}

function findSelectedMenuKey(items: typeof menuItems, pathname: string): string | undefined {
  for (const item of items) {
    if (!item || typeof item !== 'object' || !('key' in item)) continue;

    if (String(item.key).startsWith('/') && pathname.startsWith(String(item.key))) {
      return String(item.key);
    }
    if ('children' in item && item.children) {
      const childKey = findSelectedMenuKey(item.children as typeof menuItems, pathname);
      if (childKey) return childKey;
    }
  }
  return undefined;
}

function findOpenMenuKey(items: typeof menuItems, selectedKey: string): string | undefined {
  for (const item of items) {
    if (!item || typeof item !== 'object' || !('key' in item)) continue;

    if ('children' in item && item.children) {
      if (item.children.some((child) => child && typeof child === 'object' && 'key' in child && String(child.key) === selectedKey)) {
        return String(item.key);
      }
      const childOpenKey = findOpenMenuKey(item.children as typeof menuItems, selectedKey);
      if (childOpenKey) return String(item.key);
    }
  }
  return undefined;
}

function sameStringArray(left: string[], right: string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function getHeaderIntro(pathname: string) {
  if (pathname.startsWith('/system/design-system')) {
    return {
      title: '组件工作台',
      subtitle: '主题与组件库优先'
    };
  }
  return {
    title: '',
    subtitle: DEFAULT_HEADER_SUBTITLE
  };
}

function getUserInitial(user?: { real_name?: string; employee_no?: string } | null) {
  const displayName = user?.real_name?.trim() || user?.employee_no?.trim() || 'A';
  return Array.from(displayName)[0] || 'A';
}

function getAvatarSrc(avatarUrl?: string) {
  if (!avatarUrl) return undefined;
  return avatarUrl.startsWith('http') ? avatarUrl : avatarUrl;
}

export function AdminLayout() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const userMenus = useAuthStore((state) => state.menus);
  const token = useAuthStore((state) => state.token);
  const mustChangePassword = useAuthStore((state) => state.mustChangePassword);
  const accessSessionId = useAuthStore((state) => state.accessSessionId);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [collapsed, setCollapsed] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const [accountDrawer, setAccountDrawer] = useState<'profile' | 'preferences' | 'password' | null>(null);
  const [messageItems, setMessageItems] = useState<MessageRecord[]>([]);
  const [messageLoading, setMessageLoading] = useState(false);
  const lastActivityAtRef = useRef(Date.now());
  const lastHeartbeatAtRef = useRef(0);
  const idleLoggedOutRef = useRef(false);
  const category = new URLSearchParams(location.search).get('category');
  const selectedDesignCategory = isDesignCategory(category) ? category : 'overview';
  const isAdmin = user?.roles?.includes('admin') ?? false;
  const visibleMenuItems = useMemo(() => {
    return isAdmin ? menuItems : filterMenuItemsByPermissions(menuItems, collectAllowedMenuKeys(userMenus));
  }, [isAdmin, userMenus]);
  const allowedMenuPaths = useMemo(() => collectAllowedMenuPaths(userMenus), [userMenus]);
  const fallbackMenuPath = useMemo(() => getFirstMenuPath(visibleMenuItems), [visibleMenuItems]);
  const permissionLocationKey = getPermissionLocationKey(location.pathname, location.search);
  const shouldRedirectUnauthorizedPage = !isAdmin && allowedMenuPaths.size > 0 && !isPathAllowed(permissionLocationKey, allowedMenuPaths);
  const userInitial = getUserInitial(user);
  const assistantStorageKey = user
    ? `admin_floating_assistant_position_${user.id || user.employee_no}`
    : 'admin_floating_assistant_position_guest';

  const selectedKey = location.pathname.startsWith('/system/design-system')
    ? `/system/design-system?category=${selectedDesignCategory}`
    : findSelectedMenuKey(visibleMenuItems, location.pathname) || '/home';
  const headerIntro = getHeaderIntro(location.pathname);

  useEffect(() => {
    const openKey = findOpenMenuKey(visibleMenuItems, selectedKey);
    const nextOpenKeys = openKey && !collapsed ? [openKey] : [];
    setOpenKeys((current) => sameStringArray(current, nextOpenKeys) ? current : nextOpenKeys);
  }, [collapsed, selectedKey, visibleMenuItems]);

  useEffect(() => {
    if (!token || mustChangePassword) return undefined;

    lastActivityAtRef.current = Date.now();
    lastHeartbeatAtRef.current = 0;
    idleLoggedOutRef.current = false;

    const touchSession = () => {
      const now = Date.now();
      lastActivityAtRef.current = now;
      if (!accessSessionId || now - lastHeartbeatAtRef.current < SESSION_HEARTBEAT_THROTTLE_MS) return;
      lastHeartbeatAtRef.current = now;
      heartbeatAccessSession(accessSessionId).catch(() => undefined);
    };

    const logoutForIdle = async () => {
      if (idleLoggedOutRef.current) return;
      idleLoggedOutRef.current = true;
      await logoutAccessSession(accessSessionId, { preserveLastActive: true }).catch(() => undefined);
      clearAuth();
      message.warning('长时间未操作，已自动退出');
      navigate('/login', { replace: true });
    };

    const checkIdle = () => {
      if (Date.now() - lastActivityAtRef.current >= SESSION_IDLE_TIMEOUT_MS) {
        void logoutForIdle();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkIdle();
    };

    touchSession();
    const timer = window.setInterval(checkIdle, SESSION_IDLE_CHECK_MS);

    SESSION_ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, touchSession, { passive: true });
    });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearInterval(timer);
      SESSION_ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, touchSession);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [accessSessionId, clearAuth, message, mustChangePassword, navigate, token]);

  useEffect(() => {
    if (!token || mustChangePassword) {
      setMessageItems([]);
      return;
    }

    let ignore = false;
    setMessageLoading(true);
    getMessages()
      .then((rows) => {
        if (!ignore) setMessageItems(rows);
      })
      .catch((error) => {
        if (!ignore) message.error(error instanceof Error ? error.message : '获取消息失败');
      })
      .finally(() => {
        if (!ignore) setMessageLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [message, mustChangePassword, token]);

  const reloadMessages = async () => {
    const rows = await getMessages();
    setMessageItems(rows);
  };

  const handleMessageRead = async (id: string) => {
    setMessageItems((current) => current.map((item) => item.id === id ? { ...item, unread: false } : item));
    try {
      await markMessageRead(id);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '消息已读失败');
      await reloadMessages().catch(() => undefined);
    }
  };

  const handleAllMessagesRead = async () => {
    setMessageItems((current) => current.map((item) => ({ ...item, unread: false })));
    try {
      await markAllMessagesRead();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '全部已读失败');
      await reloadMessages().catch(() => undefined);
    }
  };

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (mustChangePassword) {
    return <Navigate to="/login" replace />;
  }

  if (shouldRedirectUnauthorizedPage) {
    return <Navigate to={fallbackMenuPath} replace />;
  }

  return (
    <Layout className="admin-layout">
      <Sider
        className="admin-layout__sider"
        width={184}
        collapsedWidth={64}
        collapsed={collapsed}
        trigger={null}
      >
        <div className="admin-layout__brand">
          <span className="admin-layout__brand-mark">P</span>
          <span className="admin-layout__brand-name">项目管理系统</span>
        </div>
        <Menu
          mode="inline"
          inlineCollapsed={collapsed}
          selectedKeys={[selectedKey]}
          openKeys={openKeys}
          items={visibleMenuItems}
          onOpenChange={(keys) => {
            const latestKey = keys.find((key) => !openKeys.includes(String(key)));
            const nextOpenKeys = latestKey ? [String(latestKey)] : [];
            setOpenKeys((current) => sameStringArray(current, nextOpenKeys) ? current : nextOpenKeys);
          }}
          onClick={({ key }) => {
            if (String(key).startsWith('/')) {
              navigate(key);
            }
          }}
        />
        <div className="admin-layout__sider-footer">
          <Button
            aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
            className="admin-layout__collapse"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            type="text"
            onClick={() => setCollapsed((value) => !value)}
          />
        </div>
      </Sider>
      <Layout className="admin-layout__main">
        <Header className="admin-layout__header">
          <div className="admin-layout__header-intro">
            {headerIntro ? (
              <>
                {headerIntro.title ? <strong>{headerIntro.title}</strong> : null}
                <span>{headerIntro.subtitle}</span>
              </>
            ) : null}
          </div>
          <Space className="admin-layout__header-actions" size={4}>
            <AdminMessageCenter
              loading={messageLoading}
              messages={messageItems}
              onMarkAllRead={handleAllMessagesRead}
              onMarkRead={handleMessageRead}
              onNavigate={navigate}
            />
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  { key: 'profile', icon: <UserOutlined />, label: '个人信息' },
                  { key: 'preferences', icon: <SettingOutlined />, label: '偏好设置' },
                  { key: 'password', icon: <LockOutlined />, label: '修改密码' },
                  { type: 'divider' },
                  { key: 'logout', danger: true, icon: <LogoutOutlined />, label: '退出登录' }
                ],
                onClick: async ({ key }) => {
                  if (key === 'profile') {
                    setAccountDrawer('profile');
                  }
                  if (key === 'preferences') {
                    setAccountDrawer('preferences');
                  }
                  if (key === 'password') {
                    setAccountDrawer('password');
                  }
                  if (key === 'logout') {
                    await logoutAccessSession(accessSessionId).catch(() => undefined);
                    clearAuth();
                    navigate('/login', { replace: true });
                  }
                }
              }}
            >
              <Button className="admin-layout__user-entry" type="text">
                <Avatar className="admin-layout__user-avatar" size={24} src={getAvatarSrc(user?.avatar_url)}>
                  {userInitial}
                </Avatar>
                <span>{user?.real_name || 'Admin'}</span>
                <DownOutlined className="admin-layout__user-arrow" />
              </Button>
            </Dropdown>
          </Space>
        </Header>
        <Content className="admin-layout__content">
          <Outlet />
        </Content>
      </Layout>
      <AdminFloatingAssistant storageKey={assistantStorageKey} />
      <AccountDrawers active={accountDrawer} onClose={() => setAccountDrawer(null)} />
    </Layout>
  );
}
