/**
 * Permission System - Role-Based Access Control
 *
 * PAGE_ROLE_REQUIREMENTS di lib/permissions-client.ts adalah sumber kebenaran
 * untuk menentukan role apa yang bisa akses halaman dan action apa yang diizinkan.
 *
 * tidak ada lagi dependency ke tabel role_permissions di database.
 */

export { PAGE_ROLE_REQUIREMENTS, canAccessPage, getPageActionForRole } from './permissions-client';