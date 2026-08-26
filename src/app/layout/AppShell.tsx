import type { PropsWithChildren } from 'react';

type AppShellProps = PropsWithChildren;

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <main className="app-content">{children}</main>
    </div>
  );
}
