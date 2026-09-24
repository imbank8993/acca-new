import { masterRouteHandlers } from '@/lib/master-proxy';

export const dynamic = 'force-dynamic';

export const { GET, POST, PUT, DELETE, OPTIONS } = masterRouteHandlers('waktu');
