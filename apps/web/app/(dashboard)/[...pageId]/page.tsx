'use client'

/**
 * Route dinamis untuk semua halaman registry: /<pageId> (mis. /pengaturan-users).
 * Komponen dicari di PAGE_COMPONENTS (components/page-registry.tsx);
 * jika tidak ada, jatuh ke DynamicPageRenderer (halaman dari database).
 */

import { useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useDashboardUser } from '@/components/UserContext'
import { renderPageContent, SPECIAL_PAGES } from '@/components/page-registry'

// Ambil halaman pertama dari pagesTree user sebagai tujuan fallback
function firstAllowedPage(user: any): string {
    const tree = user?.pagesTree
    if (tree && tree.length > 0) {
        if (tree[0].page) return tree[0].page
        if (tree[0].children && tree[0].children.length > 0 && tree[0].children[0].page) {
            return tree[0].children[0].page
        }
    }
    return 'dashboard'
}

export default function RegistryPage() {
    const params = useParams()
    const router = useRouter()
    const { user } = useDashboardUser()

    const pageId = useMemo(() => {
        const raw = params.pageId
        const segments = Array.isArray(raw) ? raw : [raw]
        return segments.map(s => decodeURIComponent(String(s))).join('/')
    }, [params.pageId])

    const isAllowed =
        user.pagesArray.includes(pageId) ||
        SPECIAL_PAGES.includes(pageId)

    useEffect(() => {
        if (!isAllowed) {
            const fallback = firstAllowedPage(user)
            router.replace('/' + fallback.split('/').map(encodeURIComponent).join('/'))
        }
    }, [isAllowed, router, user])

    if (!isAllowed) return null

    return <>{renderPageContent(pageId, user)}</>
}
