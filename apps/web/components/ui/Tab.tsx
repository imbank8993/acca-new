'use client';

/**
 * Tab — baris tab yang dipakai bersama di banyak halaman.
 *
 * Tiga wujud, dipilih otomatis dari LEBAR LAYAR dan JUMLAH TAB:
 *
 *   desktop           deret teks polos rata kiri, tanpa kontainer & tanpa ikon;
 *                     tab aktif tebal + garis bawah (varian 'folder' beda)
 *   mobile, 2–3 tab   segmented satu baris, semua muat — 1 ketukan
 *   mobile, ≥4 tab    tombol pemilih yang membuka MobileSheet — 2 ketukan,
 *                     tapi semua pilihan terlihat sekaligus
 *
 * Wujud mobile dipilih lewat CSS (`:has(.actab-tabs > :nth-child(4))` di
 * tab.css), BUKAN `useIsMobile`: keduanya dirender ke DOM dan yang tidak
 * dipakai disembunyikan. Alasannya server tidak tahu lebar layar, jadi
 * memilih di JS membuat wujud yang salah tampil satu frame di tiap muat
 * halaman. Bebannya cuma satu tombol; sheet-nya sendiri baru dipasang
 * setelah ditekan.
 *
 * Bentuk lama di mobile — grid 3 kolom kartu ikon-di-atas — memakan ~255px
 * (3 baris) dengan label 9.9px, dan menyisakan sel kosong tiap kali jumlah
 * tab bukan kelipatan 3.
 *
 * Gaya-nya ada di `components/tab.css` (file CSS biasa, bukan <style jsx>)
 * supaya tetap berlaku saat dipakai sebagai subkomponen di halaman lain —
 * pola yang sama dengan Modal.
 *
 * Contoh:
 *   type TabType = 'a' | 'b'
 *   const [activeTab, setActiveTab] = useTabParam<TabType>('a', ['a', 'b'])
 *   <Tab
 *     tabs={[
 *       { key: 'a', label: 'Siswa', icon: 'people-fill', hint: '912 aktif' },
 *       { key: 'b', label: 'Guru', icon: 'person-badge' },
 *     ]}
 *     activeTab={activeTab}
 *     onChange={setActiveTab}
 *     ariaLabel="Contoh tabs"
 *   />
 */

import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import LucideIcon from './LucideIcon';
import { MobileSheet, MobileOption } from '../mobile/MobileSheet';
import { useMediaQuery } from '@/hooks/use-breakpoint';
import './tab.css';

/** Samakan dengan @media di tab.css yang menyembunyikan `.actab-wrap`. */
const TABS_HIDDEN_QUERY = '(max-width: 991.98px)';

export interface TabItem<T extends string = string> {
    key: T;
    label: string;
    /**
     * Label ringkas untuk kartu tab di mobile, yang lebarnya cuma ~73px.
     *
     * Kartu itu memuat dua baris, jadi label bersuku kata banyak seperti
     * 'Relasi Orang Tua' TIDAK perlu diringkas — ia patah di spasi dengan rapi.
     * Yang perlu hanya label satu kata yang lebih lebar dari kartunya, karena
     * tidak ada spasi untuk mematahkannya dan hurufnya akan dipotong di tengah
     * kata: 'Ekstrakurikuler' → 'Ekskul'.
     *
     * Tempat lain — pill desktop, sheet pemilih, dan daftar tab di BottomNav —
     * tetap memakai `label` penuh.
     */
    shortLabel?: string;
    /** kelas ikon bootstrap-icons, mis. 'bi-person-gear' (tanpa prefix "bi") */
    icon: string;
    /**
     * Ringkasan isi tab — hanya tampil di sheet pemilih (mobile, ≥4 tab).
     * Gunakan untuk hal yang sekarang baru terlihat setelah tab dibuka,
     * mis. "912 aktif · 34 non-aktif".
     */
    hint?: string;
    badge?: React.ReactNode | number | string;
}

interface TabProps<T extends string> {
    tabs: TabItem<T>[];
    activeTab: T;
    onChange: (key: T) => void;
    ariaLabel?: string;
    className?: string;
    style?: React.CSSProperties;
    /**
     * Tulis label tab aktif sebagai subjudul header selama tab bar tersembunyi.
     *
     * Opt-in, karena slot subjudul header cuma satu: halaman yang sudah
     * mengisinya sendiri (mis. `app/jadwal/view.tsx` dengan "Berlaku mulai …")
     * akan saling menimpa kalau ini dinyalakan untuk semua halaman.
     */
    syncSubtitle?: boolean;
    /**
     * Wujud tab.
     *
     *   'default'  teks polos di desktop; di mobile tab disembunyikan dan
     *              navigasinya diambil alih tombol tengah BottomNav.
     *   'slider'   teks polos di desktop; di mobile jadi kartu ikon yang bisa
     *              digeser.
     *   'folder'   tab map folder di desktop (sudut bawah melebar, tab aktif
     *              menyatu ke kartu di bawahnya); di mobile sama dengan 'slider'.
     *
     * 'folder' MENSYARATKAN adanya kartu tepat di bawah <Tab>, karena tab aktif
     * memakai kartu itu sebagai badannya — lihat catatan prasyarat di tab.css.
     * Untuk isi yang belum tentu berupa kartu (spinner/empty state lebih dulu),
     * pakai 'slider'.
     */
    variant?: 'default' | 'slider' | 'folder';
}

const iconClassOf = (icon: string) => (icon.startsWith('bi-') ? icon : `bi-${icon}`);

export function Tab<T extends string>({
    tabs,
    activeTab,
    onChange,
    ariaLabel,
    className = '',
    style,
    syncSubtitle = false,
    variant = 'default'
}: TabProps<T>) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const titleId = useId();
    const tabsHidden = useMediaQuery(TABS_HIDDEN_QUERY);
    const activeTabRef = useRef<HTMLButtonElement | null>(null);

    // Auto-scroll active tab into view when selected in slider mode
    useEffect(() => {
        if (activeTabRef.current) {
            activeTabRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, [activeTab]);

    const containerRef = useRef<HTMLDivElement | null>(null);
    const [tabScrolledPast, setTabScrolledPast] = useState(false);

    // Track scroll position to detect when tab bar scrolls out of view under top header
    useEffect(() => {
        const checkScroll = () => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            // On mobile header height is ~56-64px. If rect.bottom <= 68, the tab bar has scrolled out of view
            const isOut = rect.bottom <= 68;
            setTabScrolledPast(isOut);
        };

        checkScroll();
        window.addEventListener('scroll', checkScroll, { capture: true, passive: true });
        document.addEventListener('scroll', checkScroll, { capture: true, passive: true });
        return () => {
            window.removeEventListener('scroll', checkScroll, { capture: true });
            document.removeEventListener('scroll', checkScroll, { capture: true });
        };
    }, []);

    const active = tabs.find(t => t.key === activeTab) ?? tabs[0];

    // Set page subtitle in header when tab bar is scrolled out of view or syncSubtitle is true
    useEffect(() => {
        if (!active) return;
        if (tabScrolledPast || syncSubtitle) {
            window.dispatchEvent(new CustomEvent('acca:set-page-subtitle', { detail: active.label }));
        } else {
            window.dispatchEvent(new CustomEvent('acca:set-page-subtitle', { detail: null }));
        }
        return () => {
            window.dispatchEvent(new CustomEvent('acca:set-page-subtitle', { detail: null }));
        };
    }, [tabScrolledPast, syncSubtitle, active?.label]);

    // Tak ada gunanya menampilkan navigasi kalau cuma ada satu pilihan — dulu
    // tiap halaman menjaga ini sendiri-sendiri (`tabs.length > 1 ? <Tab/> : null`),
    // sekarang terpusat di sini supaya halaman baru otomatis dapat perilaku ini.
    // Ditaruh SETELAH semua hook di atas (bukan early return di awal fungsi)
    // supaya urutan hook tetap konsisten kalau `tabs.length` berubah antar render.
    if (tabs.length <= 1) return null;

    const isSlider = variant === 'slider';
    // Kartu mobile berubah bentuk menurut jumlah tab: 2 tab -> baris ikon+label
    // sejajar (tak ada ruang untuk kartu persegi berdiri), 3 tab -> kartu
    // persegi panjang (ikon di atas, label di bawah, sama seperti 4 tab tapi
    // lebih lebar karena dibagi 3 bukan 4), 4+ tab -> kartu persegi yang bisa
    // digeser (lihat blok SLIDER VARIANT di tab.css).
    const isRowLayout = tabs.length === 2;
    const isThreeCard = tabs.length === 3;
    // 'folder' hanya mengubah wujud DESKTOP (blok FOLDER VARIANT di tab.css
    // seluruhnya di dalam `min-width: 768px`). Di mobile ia tetap memakai kartu
    // geser yang sama dengan 'slider', jadi kelasnya dipasang berdua — tanpa
    // itu, `.actab-wrap:not(.actab-wrap--slider)` menyembunyikan tab di mobile
    // dan halaman kehilangan navigasinya.
    const isFolder = variant === 'folder';
    const useSliderShell = isSlider || isFolder;
    const wrapClassName = `actab-wrap ${useSliderShell ? 'actab-wrap--slider' : ''} ${isRowLayout ? 'actab-wrap--few' : ''} ${isThreeCard ? 'actab-wrap--three' : ''} ${isFolder ? 'actab-wrap--folder' : ''} ${className}`.trim();

    return (
        <div ref={containerRef} className={wrapClassName} style={style}>
            <div className="actab-tabs" role="tablist" aria-label={ariaLabel}>
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            ref={isActive ? activeTabRef : null}
                            role="tab"
                            aria-selected={isActive}
                            className={`actab-tab ${isActive ? 'isActive' : ''}`}
                            onClick={() => onChange(tab.key)}
                            type="button"
                        >
                            <span className="actab-tabIconOuter">
                                <LucideIcon name={tab.icon} size={isSlider ? 22 : 15} strokeWidth={isSlider ? 1.5 : 2} className="actab-tabIcon" />
                            </span>
                            {/* Keduanya dirender; yang tidak dipakai disembunyikan
                                lewat CSS (tab.css) — sama alasannya dengan pemilihan
                                wujud mobile di atas: server tidak tahu lebar layar. */}
                            <span className="actab-tabText">{tab.label}</span>
                            {tab.shortLabel && (
                                <span className="actab-tabText actab-tabText--short">{tab.shortLabel}</span>
                            )}
                            {tab.badge !== undefined && tab.badge !== null && tab.badge !== '' && (
                                <span className="actab-tabBadge">{tab.badge}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {active && (
                <button
                    type="button"
                    className="actab-picker"
                    onClick={() => setPickerOpen(true)}
                    aria-haspopup="dialog"
                    aria-expanded={pickerOpen}
                >
                    <span className="actab-pickerIcon" aria-hidden="true">
                        <LucideIcon name={active.icon} size={16} />
                    </span>
                    <span className="actab-pickerLabel">
                        {active.label}
                        {active.badge !== undefined && active.badge !== null && active.badge !== '' && (
                            <span className="actab-tabBadge" style={{ marginLeft: 6 }}>{active.badge}</span>
                        )}
                    </span>
                    <ChevronDown size={16} className="actab-pickerChev" aria-hidden="true" />
                </button>
            )}

            {pickerOpen && active && (
                <MobileSheet
                    title={ariaLabel || 'Pilih tampilan'}
                    subtitle={`${tabs.length} pilihan`}
                    onClose={() => setPickerOpen(false)}
                    labelledBy={titleId}
                >
                    <div role="radiogroup" aria-label={ariaLabel}>
                        {tabs.map(tab => (
                            <MobileOption
                                key={tab.key}
                                icon={tab.icon}
                                hint={tab.hint}
                                selected={tab.key === activeTab}
                                onClick={() => { onChange(tab.key); setPickerOpen(false); }}
                            >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    {tab.label}
                                    {tab.badge !== undefined && tab.badge !== null && tab.badge !== '' && (
                                        <span className="actab-tabBadge">{tab.badge}</span>
                                    )}
                                </span>
                            </MobileOption>
                        ))}
                    </div>
                </MobileSheet>
            )}
        </div>
    );
}

export const Tabs = Tab;
export default Tab;
