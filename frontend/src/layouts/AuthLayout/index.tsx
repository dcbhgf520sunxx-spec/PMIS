import { Outlet } from 'react-router-dom';
import './index.css';

export function AuthLayout() {
  return (
    <main className="auth-layout">
      <div className="auth-ambient auth-ambient--one" aria-hidden="true" />
      <div className="auth-ambient auth-ambient--two" aria-hidden="true" />
      <div className="auth-ambient auth-ambient--three" aria-hidden="true" />
      <div className="auth-line auth-line--one" aria-hidden="true" />
      <div className="auth-line auth-line--two" aria-hidden="true" />
      <div className="auth-line auth-line--three" aria-hidden="true" />
      <Outlet />
    </main>
  );
}
