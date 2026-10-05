import { masterRouteHandlers } from '@/lib/master-proxy';

// Data master 'ruangan' dilayani NestJS di atas PostgreSQL VPS — lihat lib/master-proxy.ts.
export const { GET, POST, PUT, DELETE, OPTIONS } = masterRouteHandlers('ruangan');
