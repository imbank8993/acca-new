import { AsyncLocalStorage } from 'node:async_hooks';
import type { AuditContext } from '@acca/shared';
export const auditContext = new AsyncLocalStorage<AuditContext>();
