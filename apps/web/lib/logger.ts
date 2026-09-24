import { prisma } from '@/lib/prisma';

export async function logActivity(
    userId: string | undefined, // Allow undefined, handle inside
    action: string,
    details: any = null,
    reqOrIp?: Request | string // Optional, to get IP if needed
) {
    if (!userId) return; // Can't log without user

    try {
        let ipAddress = 'unknown';
        if (typeof reqOrIp === 'string') {
            ipAddress = reqOrIp;
        } else if (reqOrIp && reqOrIp.headers && typeof reqOrIp.headers.get === 'function') {
            ipAddress = reqOrIp.headers.get('x-forwarded-for') || 'local';
        }

        await prisma.activity_logs.create({
            data: {
                user_id: userId,
                action,
                details: JSON.stringify(details),
                ip_address: ipAddress
            }
        });
    } catch (err) {
        console.error('Error logging activity:', err);
    }
}
