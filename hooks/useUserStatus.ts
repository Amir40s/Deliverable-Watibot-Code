'use client';

import useSWR, { mutate } from 'swr';
import { useSession } from 'next-auth/react';

export type UserStatusData = {
  plan: string;
  status: string;
  trialDaysRemaining: number | null;
  organizationName: string | null;
  whatsappConnected: boolean;
  whatsappNumber: string | null;
  whatsappQualityRating: string | null;
  whatsappStatus: string | null;
  whatsappConnectionMethod?: string | null;
  userName?: string | null;
  userRole?: string | null;
  userImage?: string | null;
  planExpiry?: {
    isExpired: boolean;
    expiresAt?: string | Date | null;
  };
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch user status (${res.status})`);
  }
  return res.json();
};

export const USER_STATUS_CACHE_KEY = '/api/user/status';

export function mutateUserStatus(data?: UserStatusData | null, revalidate = true) {
  return mutate(USER_STATUS_CACHE_KEY, data, revalidate);
}

export function useUserStatus() {
  const { data: session, status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === 'authenticated' && !!session?.user?.id;

  const { data, error, isLoading, mutate: revalidate } = useSWR<UserStatusData | null>(
    isAuthenticated ? USER_STATUS_CACHE_KEY : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60000,
      refreshInterval: 120000,
      keepPreviousData: true,
      shouldRetryOnError: true,
      errorRetryCount: 3,
    }
  );

  return {
    userStatus: data || null,
    plan: data?.plan || session?.user?.plan || 'free',
    status: data?.status || session?.user?.status || 'PENDING',
    trialDaysRemaining: data?.trialDaysRemaining ?? session?.user?.trialDaysRemaining ?? null,
    organizationName: data?.organizationName || session?.user?.organizationName || null,
    whatsappConnected: data?.whatsappConnected ?? (session?.user?.whatsappConnected || false),
    whatsappNumber: data?.whatsappNumber || null,
    whatsappQualityRating: data?.whatsappQualityRating || null,
    whatsappStatus: data?.whatsappStatus || null,
    whatsappConnectionMethod: data?.whatsappConnectionMethod || (session?.user as any)?.whatsappConnectionMethod || null,
    userName: data?.userName || session?.user?.name || session?.user?.organizationName || session?.user?.email?.split('@')[0] || null,
    userRole: data?.userRole || session?.user?.role || null,
    userImage: data?.userImage || session?.user?.image || null,
    planExpiry: data?.planExpiry || null,
    isLoading: isAuthenticated && isLoading && !data,
    error,
    mutateUserStatus: (newData?: UserStatusData | null, shouldRevalidate = true) =>
      mutate(USER_STATUS_CACHE_KEY, newData, shouldRevalidate),
    revalidate,
  };
}
