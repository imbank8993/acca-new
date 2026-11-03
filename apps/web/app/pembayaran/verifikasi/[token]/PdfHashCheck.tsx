'use client';

import { useState } from 'react';

/** Mencocokkan sidik SHA-256 berkas PDF dengan yang tersimpan saat cetak. Berkas dibaca di browser, tidak diunggah. */
export default function PdfHashCheck({ expected }: { expected: string }) {
    const [state, setState] = useState<'idle' | 'busy' | 'match' | 'mismatch' | 'error'>('idle');
    const [name, setName] = useState('');

    const check = async (file?: File) => {
        if (!file) return;
        setName(file.name);
        setState('busy');
        try {
            if (!globalThis.crypto?.subtle) throw new Error('unsupported');
            const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
            const hex = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
            setState(hex === expected ? 'match' : 'mismatch');
        } catch {
            setState('error');
        }
    };

    return (
        <div className="rpv-check">
            <label>
                <span>Cocokkan berkas PDF (opsional)</span>
                <input type="file" accept="application/pdf,.pdf" disabled={state === 'busy'} onChange={e => void check(e.target.files?.[0])} />
            </label>
            <p className="rpv-small">Berkas hanya dibaca di perangkat ini dan tidak dikirim ke server.</p>
            <div aria-live="polite">
                {state === 'busy' && <p>Memeriksa {name}…</p>}
                {state === 'match' && <p className="rpv-status rpv-status--ok"><strong>Cocok.</strong> {name} sama persis dengan berkas yang diterbitkan.</p>}
                {state === 'mismatch' && <p className="rpv-status rpv-status--bad"><strong>Tidak cocok.</strong> {name} berbeda dari berkas yang diterbitkan. Cetakan ulang, hasil pindai, atau berkas yang disunting akan selalu berbeda; gunakan PDF asli dari ACCA.</p>}
                {state === 'error' && <p className="rpv-status rpv-status--bad">Browser ini tidak dapat memeriksa berkas. Buka halaman melalui HTTPS atau gunakan browser lain.</p>}
            </div>
        </div>
    );
}
