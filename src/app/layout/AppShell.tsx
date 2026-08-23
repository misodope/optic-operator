import type { PropsWithChildren, ReactNode } from 'react';

interface AppShellProps extends PropsWithChildren {
  status: ReactNode;
}

export function AppShell({ children, status }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">AI CAMERA OPERATOR</p>
          <h1>Optic Operator</h1>
        </div>
        <div className="topbar-status">{status}</div>
      </header>
      <main className="app-content">{children}</main>
    </div>
  );
}
