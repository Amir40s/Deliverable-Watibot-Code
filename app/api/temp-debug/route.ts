import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const messages = await prisma.message.findMany({
    where: {
      contact: {
        name: {
          contains: 'Sr leac Santer',
          mode: 'insensitive'
        }
      },
      content: {
        contains: 'Unsupported'
      }
    },
    include: {
      contact: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 5
  });

  return NextResponse.json(messages);
}
