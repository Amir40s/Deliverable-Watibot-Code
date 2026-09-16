import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        const organizationId = session?.user?.organizationId;

        if (!organizationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        if (!id) {
            return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        }

        const mediaItem = await prisma.mediaLibraryItem.findUnique({
            where: { id }
        });

        if (!mediaItem || mediaItem.organizationId !== organizationId) {
            return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 404 });
        }

        await prisma.mediaLibraryItem.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[MediaLibrary DELETE]', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
