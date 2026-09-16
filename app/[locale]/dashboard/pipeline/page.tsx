import React from 'react';
import DashboardLayoutClient from '@/components/dashboard/DashboardLayoutClient';
import { PipelineView } from '@/components/pipeline/PipelineView';

export const metadata = {
  title: 'Customer Journey Pipeline | CRM',
  description: 'Track WhatsApp leads across customizable lifecycle stages.',
};

export default function PipelinePage() {
  return (
    <DashboardLayoutClient mainClassName="p-0" mainFullBleed={true}>
      <PipelineView />
    </DashboardLayoutClient>
  );
}
