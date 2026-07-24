import { useEffect, useMemo, useState } from 'react';
import { App, Form, Space } from 'antd';
import { CameraOutlined } from '@ant-design/icons';
import {
  AdminButton,
  AdminAvatar,
  AdminDrawer,
  AdminFormItem,
  AdminInput,
  AdminModal,
  AdminPasswordInput,
  AdminSelect,
  AdminUpload
} from '../../../components/admin';
import {
  changeCurrentPhone,
  getCurrentUser,
  getUserPreference,
  resetCurrentAvatar,
  updateUserPreference,
  uploadCurrentAvatar
} from '../../../api/authApi';
import { useAuthStore } from '../../../stores/authStore';
import type { CurrentUserResult } from '../../../api/authApi';
import type { UserPreference } from '../../../stores/authStore';
import { PasswordChangeModal } from './PasswordChangeModal';
import './AccountDrawers.css';

const AVATAR_MAX_SIZE_MB = 5;
const AVATAR_MAX_SIZE_BYTES = AVATAR_MAX_SIZE_MB * 1024 * 1024;

type AccountDrawersProps = {
  active: 'profile' | 'preferences' | 'password' | null;
  onClose: () => void;
};

type PhoneFormValues = {
  currentPhone: string;
  newPhone: string;
  password: string;
};

function formatDate(value?: string) {
  return String(value || '').slice(0, 19).replace('T', ' ') || '-';
}

function toUserInfo(user: CurrentUserResult) {
  return {
    id: user.id,
    employee_no: user.employee_no,
    real_name: user.real_name,
    phone: user.phone,
    avatar_url: user.avatar_url
  };
}

function getAvatarSrc(avatarUrl?: string) {
  if (!avatarUrl) return undefined;
  return avatarUrl.startsWith('http') ? avatarUrl : avatarUrl;
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(new Error('头像读取失败'));
    reader.readAsDataURL(file);
  });
}

export function AccountDrawers({ active, onClose }: AccountDrawersProps) {
  const { message } = App.useApp();
  const menus = useAuthStore((state) => state.menus);
  const user = useAuthStore((state) => state.user);
  const preference = useAuthStore((state) => state.preference);
  const setUser = useAuthStore((state) => state.setUser);
  const setPreference = useAuthStore((state) => state.setPreference);
  const [preferenceForm] = Form.useForm<UserPreference>();
  const [phoneForm] = Form.useForm<PhoneFormValues>();
  const [currentUser, setCurrentUser] = useState<CurrentUserResult>();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [savingPreference, setSavingPreference] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [resettingAvatar, setResettingAvatar] = useState(false);

  const routeOptions = useMemo(() => {
    const items: Array<{ label: string; value: string }> = [{ label: '首页', value: '/home' }];
    const collect = (menuList: typeof menus) => {
      menuList.forEach((menu) => {
        if (menu.path && !items.some((item) => item.value === menu.path)) {
          items.push({ label: menu.name, value: menu.path });
        }
        if (menu.children?.length) collect(menu.children);
      });
    };
    collect(menus);
    return items;
  }, [menus]);

  const profileOpen = active === 'profile';
  const preferenceOpen = active === 'preferences';

  useEffect(() => {
    if (active !== 'password') return;
    setPasswordOpen(true);
    onClose();
  }, [active, onClose]);

  useEffect(() => {
    if (!profileOpen) return;
    getCurrentUser().then((result) => {
      setCurrentUser(result);
      setUser(toUserInfo(result));
    });
  }, [profileOpen, setUser]);

  useEffect(() => {
    if (!preferenceOpen) return;
    getUserPreference().then((result) => {
      setPreference(result);
      preferenceForm.setFieldsValue(result);
    });
  }, [preferenceForm, preferenceOpen, setPreference]);

  const handleAvatarUpload = async (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      message.error('头像仅支持 JPG、PNG、WEBP 格式');
      return false;
    }
    if (file.size > AVATAR_MAX_SIZE_BYTES) {
      message.error(`头像大小不能超过 ${AVATAR_MAX_SIZE_MB}MB`);
      return false;
    }

    setUploadingAvatar(true);
    try {
      const contentBase64 = await fileToBase64(file);
      const result = await uploadCurrentAvatar({
        fileName: file.name,
        mimeType: file.type,
        contentBase64
      });
      const nextUser = {
        ...(user || {
          id: currentUser?.id || 0,
          employee_no: currentUser?.employee_no || '',
          real_name: currentUser?.real_name || ''
        }),
        avatar_url: result.avatar_url
      };
      setUser(nextUser);
      setCurrentUser((prev) => prev ? { ...prev, avatar_url: result.avatar_url } : prev);
      message.success('头像已更新');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '头像上传失败');
    } finally {
      setUploadingAvatar(false);
    }

    return false;
  };

  const handleResetAvatar = async () => {
    setResettingAvatar(true);
    try {
      const result = await resetCurrentAvatar();
      const nextUser = {
        ...(user || {
          id: currentUser?.id || 0,
          employee_no: currentUser?.employee_no || '',
          real_name: currentUser?.real_name || ''
        }),
        avatar_url: result.avatar_url || undefined
      };
      setUser(nextUser);
      setCurrentUser((prev) => prev ? { ...prev, avatar_url: result.avatar_url || undefined } : prev);
      message.success('头像已重置');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '头像重置失败');
    } finally {
      setResettingAvatar(false);
    }
  };

  const handleOpenPhoneModal = () => {
    phoneForm.setFieldsValue({
      currentPhone: currentUser?.phone || user?.phone || '',
      newPhone: '',
      password: ''
    });
    setPhoneOpen(true);
  };

  const handleChangePhone = async () => {
    const values = await phoneForm.validateFields();
    setSavingPhone(true);
    try {
      const result = await changeCurrentPhone({
        phone: values.newPhone,
        password: values.password
      });
      setCurrentUser(result);
      setUser(toUserInfo(result));
      setPhoneOpen(false);
      phoneForm.resetFields();
      message.success('手机号已更新');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '手机号修改失败');
    } finally {
      setSavingPhone(false);
    }
  };

  const handleSavePreference = async () => {
    const values = await preferenceForm.validateFields();
    setSavingPreference(true);
    try {
      const result = await updateUserPreference(values);
      setPreference(result);
      message.success('偏好设置已保存');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSavingPreference(false);
    }
  };

  return (
    <>
      <AdminDrawer
        title="个人信息"
        open={profileOpen}
        width={420}
        onClose={onClose}
      >
        <div className="account-drawer__profile-card">
          <AdminUpload
            beforeUpload={handleAvatarUpload}
            maxCount={1}
            showUploadList={false}
            accept="image/jpeg,image/png,image/webp"
          >
            <AdminButton className="account-drawer__avatar-upload" type="text" aria-label="上传头像">
              {getAvatarSrc(currentUser?.avatar_url || user?.avatar_url) ? (
                <AdminAvatar
                  className="account-drawer__avatar account-drawer__avatar--image"
                  size={52}
                  src={getAvatarSrc(currentUser?.avatar_url || user?.avatar_url)}
                />
              ) : (
                <span className="account-drawer__avatar account-drawer__avatar--default">
                  <span>{Array.from(currentUser?.real_name || user?.real_name || 'A')[0]}</span>
                </span>
              )}
              <span className="account-drawer__avatar-mask">
                <CameraOutlined />
              </span>
              {uploadingAvatar ? <span className="account-drawer__avatar-loading">上传中</span> : null}
            </AdminButton>
          </AdminUpload>
          <div className="account-drawer__profile-main">
            <strong>{currentUser?.real_name || user?.real_name || '-'}</strong>
            <span>{currentUser?.employee_no || user?.employee_no || '-'}</span>
            {getAvatarSrc(currentUser?.avatar_url || user?.avatar_url) ? (
              <AdminButton
                className="account-drawer__action-button account-drawer__avatar-reset"
                loading={resettingAvatar}
                onClick={handleResetAvatar}
              >
                重置头像
              </AdminButton>
            ) : null}
          </div>
        </div>

        <div className="account-drawer__info-list">
          <div className="account-drawer__info-item">
            <span>最近登录时间</span>
            <strong>{formatDate(currentUser?.last_login_at)}</strong>
          </div>
          <div className="account-drawer__info-item account-drawer__info-item--with-action">
            <div>
              <span>手机号</span>
              <strong>{currentUser?.phone || user?.phone || '-'}</strong>
            </div>
            <AdminButton className="account-drawer__action-button account-drawer__inline-action" onClick={handleOpenPhoneModal}>更改手机号</AdminButton>
          </div>
        </div>

        <div className="account-drawer__security-action">
          <AdminButton className="account-drawer__action-button" block onClick={() => setPasswordOpen(true)}>修改密码</AdminButton>
        </div>
      </AdminDrawer>

      <AdminDrawer
        title="偏好设置"
        open={preferenceOpen}
        width={420}
        onClose={onClose}
        footer={(
          <Space>
            <AdminButton onClick={onClose}>取消</AdminButton>
            <AdminButton type="primary" loading={savingPreference} onClick={handleSavePreference}>保存</AdminButton>
          </Space>
        )}
      >
        <Form
          className="account-drawer__form"
          form={preferenceForm}
          initialValues={preference}
          layout="vertical"
        >
          <AdminFormItem name="default_route" label="默认进入页面" rules={[{ required: true, message: '请选择默认进入页面' }]}>
            <AdminSelect options={routeOptions} />
          </AdminFormItem>
          <AdminFormItem name="default_page_size" label="列表默认条数" rules={[{ required: true, message: '请选择列表默认条数' }]}>
            <AdminSelect
              options={[
                { label: '10 条/页', value: 10 },
                { label: '20 条/页', value: 20 },
                { label: '50 条/页', value: 50 },
                { label: '100 条/页', value: 100 }
              ]}
            />
          </AdminFormItem>
        </Form>
      </AdminDrawer>

      <AdminModal
        title="更改手机号"
        open={phoneOpen}
        width={420}
        confirmLoading={savingPhone}
        onCancel={() => setPhoneOpen(false)}
        onOk={handleChangePhone}
      >
        <Form className="account-drawer__form" form={phoneForm} layout="vertical">
          <AdminFormItem name="currentPhone" label="原手机号">
            <AdminInput disabled placeholder="-" />
          </AdminFormItem>
          <AdminFormItem
            name="newPhone"
            label="新手机号"
            rules={[
              { required: true, message: '请输入新手机号' },
              { pattern: /^1\d{10}$/, message: '请输入 11 位手机号' }
            ]}
          >
            <AdminInput placeholder="请输入新手机号" />
          </AdminFormItem>
          <AdminFormItem name="password" label="登录密码" rules={[{ required: true, message: '请输入登录密码' }]}>
            <AdminPasswordInput placeholder="请输入登录密码" />
          </AdminFormItem>
        </Form>
      </AdminModal>

      <PasswordChangeModal
        open={passwordOpen}
        onCancel={() => setPasswordOpen(false)}
        onSuccess={() => setPasswordOpen(false)}
      />
    </>
  );
}
