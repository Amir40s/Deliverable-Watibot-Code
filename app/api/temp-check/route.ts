import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.organizationId) return NextResponse.json({ error: "No session" });

        const org = await prisma.organization.findUnique({
            where: { id: session.user.organizationId }
        });
        
        if (!org || !org.whatsappPhoneNumberId) {
             return NextResponse.json({ error: "No Phone ID" });
        }
        
        const phoneId = org.whatsappPhoneNumberId;
        const token = org.metaAccessToken;
        
        const resPhone = await fetch(`https://graph.facebook.com/v21.0/${phoneId}?fields=display_phone_number,quality_rating`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const dataPhone = await resPhone.json();

        return NextResponse.json({ phoneEndpoint: dataPhone, token_preview: token?.substring(0, 20) });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
