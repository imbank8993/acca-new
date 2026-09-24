/**
 * Pola UI mobile bersama (<768px).
 *
 * Dipakai lewat `useIsMobile()` dari lib/use-breakpoint.ts untuk memilih SALAH
 * SATU cabang render — bukan merender dua-duanya lalu menyembunyikan satu
 * dengan CSS seperti pola `.sk__tableWrap`/`.sk__cards` yang lama.
 */

export {
    MobileSheet,
    MobileKV,
    MobileSection,
    MobileOption,
} from './MobileSheet'

export {
    MobileList,
    MobileListItem,
    MobileAvatar,
    MobileEmpty,
    MobileLoadMore,
    MobileFab,
    MobileSelectionBar,
    initials,
    tintOf,
} from './MobileList'

export {
    MobileToolbar,
    MobileMenu,
    MobileChips,
    MobileChip,
} from './MobileToolbar'

export type { MobileMenuItem } from './MobileToolbar'
