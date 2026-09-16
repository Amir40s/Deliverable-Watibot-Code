import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const organizationId = session?.user?.organizationId;

        if (!organizationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const mediaItems = await prisma.mediaLibraryItem.findMany({
            where: { organizationId },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(mediaItems);
    } catch (error: any) {
        console.error('[MediaLibrary GET]', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const organizationId = session?.user?.organizationId;

        if (!organizationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { name, url, type, relativePath, storageProvider, mimeType, fileSize, originalName } = body;

        if (!name || !url) {
            return NextResponse.json({ error: 'Missing name or url' }, { status: 400 });
        }

        const newMedia = await prisma.mediaLibraryItem.create({
            data: {
                organizationId,
                name,
                url,
                type: type || 'image',
                relativePath: relativePath || null,
                storageProvider: storageProvider || (url.includes('cloudinary.com') ? 'cloudinary' : 'local'),
                mimeType: mimeType || null,
                fileSize: fileSize || null,
                originalName: originalName || name
            }
        });

        return NextResponse.json(newMedia);
    } catch (error: any) {
        console.error('[MediaLibrary POST]', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
