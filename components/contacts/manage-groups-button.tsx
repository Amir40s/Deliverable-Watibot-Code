'use client';
import { useTranslations } from 'next-intl';

import { useState } from 'react';
import { PillButton } from '@/components/ui/pill-button';
import { Users } from 'lucide-react';
import { ManageGroupsModal } from './manage-groups-modal';

export function ManageGroupsButton() {
    const t = useTranslations('Contacts');

  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <PillButton
        variant="outline"
        label={t('manageGroups')}
        className="w-full sm:w-auto h-10 px-4 text-slate-700 bg-slate-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:bg-slate-100"
        onClick={() => setIsOpen(true)}
      />
      <ManageGroupsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
