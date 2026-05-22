'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

/* Configuration the push-enable surfaces need to know about the server.
 *
 * `vapidPublicKey` is undefined when the server can't push (env not set);
 * consumers hide themselves in that case. `basePath` matters under staging
 * deploys where the app lives under `/app-car-manager-v2` and the service
 * worker must register at the matching path.
 *
 * Both values originate from NEXT_PUBLIC_* envs and are passed into the
 * Provider by the server-rendered AppShell so client code never has to
 * touch `process.env`. */
interface PushConfig {
  vapidPublicKey: string | undefined;
  basePath: string;
}

const PushConfigContext = createContext<PushConfig | null>(null);

interface PushConfigProviderProps {
  vapidPublicKey: string | undefined;
  basePath: string;
  children: ReactNode;
}

export function PushConfigProvider({
  vapidPublicKey,
  basePath,
  children,
}: PushConfigProviderProps) {
  const value = useMemo<PushConfig>(
    () => ({ vapidPublicKey, basePath }),
    [vapidPublicKey, basePath],
  );
  return <PushConfigContext.Provider value={value}>{children}</PushConfigContext.Provider>;
}

export function usePushConfig(): PushConfig {
  const ctx = useContext(PushConfigContext);
  if (!ctx) {
    throw new Error('usePushConfig must be used inside <PushConfigProvider>');
  }
  return ctx;
}
