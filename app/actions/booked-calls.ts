'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function bookCallAction(data: { date: string; time: string; phoneNumber: string }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.organizationId) {
      return { error: 'Unauthorized. Please log in first.' };
    }

    const { date, time, phoneNumber } = data;
    if (!date || !time || !phoneNumber) {
      return { error: 'All fields (date, time, phone number) are required.' };
    }

    const bookedCall = await prisma.bookedCall.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        date,
        time,
        phoneNumber,
        status: 'PENDING',
      },
    });

    return { success: true, bookedCall };
  } catch (error: any) {
    console.error('Error booking call:', error);
    return { error: error.message || 'Failed to book the call.' };
  }
}

export async function getBookedCallsAction() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || (session?.user?.role !== 'SUPER_ADMIN' && session?.user?.role !== 'ADMIN')) {
      return { error: 'Unauthorized. Admin access required.' };
    }

    const bookedCalls = await prisma.bookedCall.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        organization: {
          select: {
            name: true,
          },
        },
      },
    });

    return { success: true, bookedCalls };
  } catch (error: any) {
    console.error('Error fetching booked calls:', error);
    return { error: error.message || 'Failed to fetch booked calls.' };
  }
}

export async function completeBookedCallAction(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || (session?.user?.role !== 'SUPER_ADMIN' && session?.user?.role !== 'ADMIN')) {
      return { error: 'Unauthorized. Admin access required.' };
    }

    const updatedCall = await prisma.bookedCall.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });

    return { success: true, updatedCall };
  } catch (error: any) {
    console.error('Error updating booked call status:', error);
    return { error: error.message || 'Failed to update call status.' };
  }
}
