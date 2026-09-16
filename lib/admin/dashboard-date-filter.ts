export type DateFilterType = 'today' | 'yesterday' | '7days' | 'week' | 'custom' | 'all';

export interface DateFilterParams {
    filter?: DateFilterType | string;
    startDate?: string;
    endDate?: string;
}

export interface ResolvedDateBounds {
    from: Date | null;
    to: Date | null;
    label: string;
    subLabel: string;
    filterType: DateFilterType;
}

export function getDateBounds(params?: DateFilterParams): ResolvedDateBounds {
    const filter = (params?.filter as DateFilterType) || 'all';
    const now = new Date();

    if (filter === 'today') {
        const from = new Date(now);
        from.setHours(0, 0, 0, 0);
        const to = new Date(now);
        to.setHours(23, 59, 59, 999);
        const subLabel = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return { from, to, label: 'Today', subLabel, filterType: 'today' };
    }

    if (filter === 'yesterday') {
        const from = new Date(now);
        from.setDate(now.getDate() - 1);
        from.setHours(0, 0, 0, 0);
        const to = new Date(now);
        to.setDate(now.getDate() - 1);
        to.setHours(23, 59, 59, 999);
        const subLabel = from.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return { from, to, label: 'Yesterday', subLabel, filterType: 'yesterday' };
    }

    if (filter === '7days' || filter === 'week') {
        const from = new Date(now);
        from.setDate(now.getDate() - 7);
        from.setHours(0, 0, 0, 0);
        const to = new Date(now);
        to.setHours(23, 59, 59, 999);
        const subLabel = `${from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        return { from, to, label: 'Last 7 Days', subLabel, filterType: '7days' };
    }

    if (filter === 'custom' && params?.startDate) {
        const from = new Date(params.startDate);
        from.setHours(0, 0, 0, 0);
        const to = params.endDate ? new Date(params.endDate) : new Date(params.startDate);
        to.setHours(23, 59, 59, 999);
        const subLabel = `${from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        return { from, to, label: 'Custom Range', subLabel, filterType: 'custom' };
    }

    // Default: all time
    return { from: null, to: null, label: 'All Time', subLabel: 'Entire platform history', filterType: 'all' };
}
