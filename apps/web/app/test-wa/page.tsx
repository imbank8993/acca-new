'use client';
import MaintenanceBanner from '@/components/MaintenanceBanner';

import { useState } from 'react';
import { useTimezone } from '@/hooks/use-timezone';

function TestWAPage() {
    const [result, setResult] = useState('');
    const [loading, setLoading] = useState(false);
    const { formatDateTime } = useTimezone();

    const testProxy = async () => {
        setLoading(true);
        setResult('Testing proxy...');

        try {
            const testMessage = `🧪 Test dari ACCA - ${await formatDateTime(new Date())}`;

            console.log('[Test WA] API_BASE:', process.env.NEXT_PUBLIC_API_URL);
            console.log('[Test WA] Sending to proxy...');

            const res = await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: testMessage,
                    target: '120363407327239145@g.us'
                })
            });

            const data = await res.json();
            console.log('[Test WA] Response:', JSON.stringify(data, null, 2));

            setResult(JSON.stringify(data, null, 2));
        } catch (err: any) {
            console.error('[Test WA] Error:', err);
            setResult('Error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const testDirect = async () => {
        setLoading(true);

        // Uji langsung ke Fonnte DIHAPUS: halaman ini komponen klien, sehingga
        // token yang ditulis di sini ikut terkirim ke setiap browser yang
        // membukanya. Token WhatsApp hanya boleh dipegang server — pakai tombol
        // "Test Proxy" di atas, yang menembak route API kita sendiri.
        try {
            setResult(
                'Uji langsung dinonaktifkan demi keamanan (token tidak boleh ada di sisi klien).\n' +
                'Gunakan "Test Proxy" — pengiriman dilakukan server lewat /api/whatsapp.'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '40px', fontFamily: 'monospace' }}>
            <h1>🧪 WhatsApp Test Page</h1>

            <div style={{ marginBottom: '20px' }}>
                <p>Environment:</p>
                <code>
                    NEXT_PUBLIC_API_URL: {process.env.NEXT_PUBLIC_API_URL || 'NOT SET'}
                </code>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button
                    onClick={testProxy}
                    disabled={loading}
                    style={{
                        padding: '10px 20px',
                        background: '#3083FF',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: loading ? 'not-allowed' : 'pointer'
                    }}
                >
                    {loading ? 'Testing...' : 'Test Proxy'}
                </button>

                <button
                    onClick={testDirect}
                    disabled={loading}
                    style={{
                        padding: '10px 20px',
                        background: '#25D366',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: loading ? 'not-allowed' : 'pointer'
                    }}
                >
                    Test Direct
                </button>
            </div>

            <div style={{
                background: '#f5f5f5',
                padding: '15px',
                borderRadius: '5px',
                whiteSpace: 'pre-wrap',
                fontSize: '12px'
            }}>
                {result || 'Click a button to test'}
            </div>
        </div>
    );
}


// --- AUTOMATED MAINTENANCE WRAPPER ---
export default function MaintenanceWrappedTestWAPage(props: any) {
    return (
        <>
            <MaintenanceBanner pageKey="maintenance_test_wa" />
            <TestWAPage {...props} />
        </>
    );
}
