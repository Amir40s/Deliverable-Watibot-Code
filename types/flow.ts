export interface Flow {
    id: string;
    organizationId: string;
    name: string;
    description: string | null;
    trigger: any;
    nodes: any;
    edges: any;
    isActive: boolean;
    welcomeMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
    platform?: string | null;
    _count?: {
        executions: number;
    };
}
