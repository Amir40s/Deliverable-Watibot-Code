'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import { ReactNode } from 'react';
import { Toaster } from 'sonner';

import { PusherProvider } from './providers/PusherProvider';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider refetchInterval={300} refetchOnWindowFocus={false}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem storageKey="watibot-theme" enableColorScheme={true}>
        <PusherProvider>
          {children}
        </PusherProvider>
        <Toaster richColors position="bottom-right" />
      </ThemeProvider>
    </SessionProvider>
  );
}
