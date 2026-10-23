'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { changeLayer, newSigner, pointTemplate, ptToMm, mmToPt, templateLayers, fitLayerPlacement, resizeLayerWidth, MIN_QR_MM } from '@/lib/e-sertifikat/layout';
import type { CertificateTemplate, Recipient, TextPlacement } from '@/lib/e-sertifikat/model';
import type { TemplateGeometry } from '@/lib/e-sertifikat/geometry';

type Props = { eventId: string; template: CertificateTemplate; numberPrefix: string; recipients: Recipient[]; onChange: (template: CertificateTemplate) => void; disabled?: boolean };
const fallback = { name: 'Nama Peserta Contoh', institution: 'Asal Sekolah / Instansi', identities: {} as Record<string, string> };
function PrecisionInput({ value, onCommit, label, min = 0, max, step = .01 }: { value: number; onCommit: (value: number) => void; label: string; min?: number; max?: number; step?: number }) {
    const [raw, setRaw] = useState(String(value)); const editing = useRef(false);
    useEffect(() => { if (!editing.current) setRaw(String(value)); }, [value]);
    return <input aria-label={label} type="number" min={min} max={max} step={step} value={raw}
        onFocus={() => { editing.current = true; }} onChange={e => setRaw(e.target.value)}
        onBlur={() => { editing.current = false; const parsed = Number(raw); if (raw.trim() && Number.isFinite(parsed)) { const next = Math.max(min, Math.min(max ?? Infinity, parsed)); setRaw(String(next)); onCommit(next); } else setRaw(String(value)); }}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />;
}
export default function TemplateEditor(props: Props) {
    const { eventId, template, numberPrefix, recipients, disabled } = props;
    const latest = useRef(props); latest.current = props;
    const [geometry, setGeometry] = useState<TemplateGeometry | null>(null), [error, setError] = useState('');
    const [signerOptions, setSignerOptions] = useState<{ id: string; nama_lengkap: string }[]>([]), [signerError, setSignerError] = useState(false);
    const [selected, setSelected] = useState('name'), [exampleId, setExampleId] = useState('');
    const [zoom, setZoom] = useState('fit'), [containerWidth, setContainerWidth] = useState(800), [grid, setGrid] = useState(false), [rendering, setRendering] = useState(false);
    const viewportRef = useRef<HTMLDivElement>(null), stageRef = useRef<HTMLDivElement>(null), canvasRef = useRef<HTMLCanvasElement>(null);
    const pdfDocument = useRef<any>(null), renderTask = useRef<any>(null), drag = useRef<{ id: string; startX: number; startY: number; x: number; y: number; scale: number; pointer: number } | null>(null);
    const tap = useRef<{ x: number; y: number; pointer: number } | null>(null);
    const resize = useRef<{ id: string; startX: number; startY: number; scale: number; pointer: number; placement: TextPlacement; qr: boolean } | null>(null);
    const [pdfVersion, setPdfVersion] = useState(0);
    const sample = recipients.find(row => row.id === exampleId) || recipients[0] || fallback;
    const identityKeys = useMemo(() => [...new Set(recipients.flatMap(row => Object.keys(row.identities)))], [recipients]);
    const normalized = !!geometry && template.unit === 'pt' && Math.abs((template.page?.width || 0) - geometry.width) < .01 && Math.abs((template.page?.height || 0) - geometry.height) < .01;
    const scale = geometry ? zoom === 'fit' ? Math.min(1.5, Math.max(.08, (containerWidth - 32) / geometry.width)) : Number(zoom) : 1;
    const layers = useMemo(() => normalized ? templateLayers(template, sample, `${numberPrefix}/0001`) : [], [normalized, template, sample, numberPrefix]);
    const active = layers.find(layer => layer.id === selected) || layers[0];
    const sizeLimit = active && geometry ? Math.max(0, Math.min(geometry.width - active.placement.x, active.qr ? geometry.height - active.placement.y : Infinity)) : 0;
    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/e-sertifikat/signers', { signal: controller.signal }).then(async response => { const result = await response.json(); if (!response.ok || !result.ok) throw new Error(); return result.data; })
            .then(data => { if (!controller.signal.aborted) setSignerOptions(data); }).catch(() => { if (!controller.signal.aborted) setSignerError(true); });
        return () => controller.abort();
    }, []);
    useEffect(() => {
        setGeometry(null); setError(''); const controller = new AbortController();
        fetch(`/api/e-sertifikat/${eventId}/geometry/${template.assetId}`, { signal: controller.signal, cache: 'no-store' }).then(async response => {
            const result = await response.json(); if (!response.ok || !result.ok) throw new Error(result.error || 'Ukuran template tidak dapat dibaca'); return result.data;
        }).then(data => { if (!controller.signal.aborted) setGeometry(data); }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
        return () => { controller.abort(); pdfDocument.current?.destroy(); pdfDocument.current = null; };
    }, [eventId, template.assetId]);
    useEffect(() => {
        if (!geometry) return;
        const current = latest.current;
        const next = pointTemplate(current.template, geometry, identityKeys);
        if (JSON.stringify(next) !== JSON.stringify(current.template)) current.onChange(next);
    }, [geometry, identityKeys]);
    useEffect(() => {
        const element = viewportRef.current; if (!element) return;
        const observer = new ResizeObserver(() => setContainerWidth(element.clientWidth)); observer.observe(element); setContainerWidth(element.clientWidth);
        return () => observer.disconnect();
    }, []);
    // The canvas uses the same PDF bytes as downloads, including font sizing and line breaks.
    useEffect(() => {
        if (!normalized) return;
        const controller = new AbortController(); let loading: any;
        const timer = setTimeout(async () => {
            setRendering(true);
            try {
                const response = await fetch(`/api/e-sertifikat/${eventId}/preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
                    body: JSON.stringify({ template, name: sample.name, institution: sample.institution, identities: sample.identities }) });
                if (!response.ok) throw new Error((await response.json()).error || 'Pratinjau gagal');
                const bytes = await response.arrayBuffer(), pdfjs = await import('pdfjs-dist');
                if (controller.signal.aborted) return;
                pdfjs.GlobalWorkerOptions.workerSrc = '/api/public/e-sertifikat-worker';
                loading = pdfjs.getDocument({ data: bytes, isEvalSupported: false });
                const document = await loading.promise;
                if (controller.signal.aborted) { await document.destroy(); return; }
                renderTask.current?.cancel(); await pdfDocument.current?.destroy(); pdfDocument.current = document;
                setError(''); setPdfVersion(version => version + 1);
            } catch (e: any) { if (!controller.signal.aborted) setError(e.message || 'Pratinjau gagal'); }
            finally { if (!controller.signal.aborted) setRendering(false); }
        }, 450);
        return () => { clearTimeout(timer); controller.abort(); if (loading && !pdfDocument.current) loading.destroy(); };
    }, [eventId, template, normalized, sample.name, sample.institution, sample.identities]);
    useEffect(() => {
        const document = pdfDocument.current, canvas = canvasRef.current;
        if (!document || !canvas || !geometry) return;
        let cancelled = false;
        (async () => {
            try {
                renderTask.current?.cancel();
                const page = await document.getPage(1); if (cancelled) return;
                const pixelRatio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(12_000_000 / (geometry.width * geometry.height * scale * scale)));
                const viewport = page.getViewport({ scale: scale * pixelRatio });
                canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
                renderTask.current = page.render({ canvasContext: canvas.getContext('2d')!, viewport }); await renderTask.current.promise;
            } catch (e: any) { if (!cancelled && e.name !== 'RenderingCancelledException') setError('Pratinjau belum dapat ditampilkan. Coba simpan dan buka PDF.'); }
        })();
        return () => { cancelled = true; renderTask.current?.cancel(); };
    }, [pdfVersion, scale, geometry]);
    const update = (patch: Partial<TextPlacement>, id = active?.id) => {
        if (!id || !geometry || disabled) return;
        const current = latest.current.template;
        const layer = templateLayers(current, sample, `${numberPrefix}/0001`).find(item => item.id === id); if (!layer) return;
        latest.current.onChange(changeLayer(current, id, fitLayerPlacement(layer.placement, patch, geometry, layer.qr)));
    };
    const changeSigner = (id: string, patch: Record<string, unknown>) => latest.current.onChange({ ...latest.current.template, signers: (latest.current.template.signers || []).map(s => s.id === id ? { ...s, ...patch } : s) });
    const selectLayer = (id: string) => { setSelected(id); stageRef.current?.focus({ preventScroll: true }); };
    return <div className="ec-editor">
        <details className="ec-signers"><summary>Penandatangan <span>{template.signers?.length || 0}</span></summary><div className="ec-settings-body"><div className="ec-section-title"><h3>Penandatangan</h3><button type="button" className="ec-button ec-button--soft" disabled={disabled || !geometry || (template.signers?.length || 0) >= 3} onClick={() => props.onChange({ ...template, signers: [...(template.signers || []), newSigner(geometry!, template.signers?.length || 0)] })}>Tambah penandatangan</button></div>
            {signerError && <small>Daftar pegawai belum dapat dimuat. Nama penandatangan tetap dapat diisi manual.</small>}
            {!template.signers?.length && <p className="ec-muted">Minimal satu penandatangan.</p>}
            {(template.signers || []).map((signer, index) => <div className="ec-signer" key={signer.id}><strong>Penandatangan {index + 1}</strong><div className="ec-form-grid">
                <label>Pilih pegawai<select aria-label={`Pilih pegawai ${index + 1}`} disabled={disabled} value="" onChange={e => { const option = signerOptions.find(row => row.id === e.target.value); if (option) changeSigner(signer.id, { name: option.nama_lengkap }); }}><option value="">Pilih dari daftar / isi manual</option>{signerOptions.map(option => <option key={option.id} value={option.id}>{option.nama_lengkap}</option>)}</select></label>
                <label>Nama penandatangan<input aria-label={`Nama penandatangan ${index + 1}`} maxLength={180} value={signer.name} disabled={disabled} onChange={e => changeSigner(signer.id, { name: e.target.value })} /></label>
                <label>Jabatan<input aria-label={`Jabatan penandatangan ${index + 1}`} maxLength={200} value={signer.title} disabled={disabled} onChange={e => changeSigner(signer.id, { title: e.target.value })} /></label></div>
                <div className="ec-actions"><label className="ec-check"><input type="checkbox" checked={signer.print} disabled={disabled} onChange={e => changeSigner(signer.id, { print: e.target.checked })} /> Cetak nama dan jabatan di sertifikat</label>{signer.print && <button className="ec-text-button" onClick={() => selectLayer(`signer:${signer.id}:name`)}>Atur posisi</button>}<button className="ec-text-button ec-danger" disabled={disabled} onClick={() => props.onChange({ ...template, signers: template.signers!.filter(s => s.id !== signer.id) })}>Hapus</button></div>
            </div>)}
        </div></details>
        <div className="ec-editor-toolbar"><div><h3>Tata letak</h3><small>Geser elemen · Tarik pegangan untuk mengubah ukuran</small></div>
            <label>Zoom<select aria-label="Zoom template" value={zoom} onChange={e => setZoom(e.target.value)}><option value="fit">Pas area</option>{[.5, 1, 1.5, 2, 3].map(value => <option key={value} value={value}>{value * 100}%</option>)}</select></label>
            <label className="ec-check"><input type="checkbox" checked={grid} onChange={e => setGrid(e.target.checked)} /> Kisi 5 mm</label>
            {!!recipients.length && <label>Contoh peserta<select aria-label="Contoh peserta" value={exampleId || recipients[0].id} onChange={e => setExampleId(e.target.value)}>{recipients.map(row => <option value={row.id} key={row.id}>{row.name}</option>)}</select></label>}
        </div>
        <div className="ec-editor-workspace"><aside className="ec-editor-controls"><label>Elemen aktif<select aria-label="Elemen aktif" value={active?.id || ''} onChange={e => selectLayer(e.target.value)}>{layers.map(layer => <option key={layer.id} value={layer.id}>{layer.label}</option>)}</select></label>
            <div className="ec-element-shortcuts" aria-label="Pilih elemen">{layers.filter(layer => ['name', 'institution', 'qr'].includes(layer.id)).map(layer => <button key={layer.id} type="button" disabled={disabled} aria-pressed={active?.id === layer.id} onClick={() => selectLayer(layer.id)}>{layer.id === 'name' ? 'Nama' : layer.id === 'institution' ? 'Sekolah' : 'QR'}</button>)}</div>
            <details className="ec-control-details"><summary>Elemen ditampilkan</summary><div className="ec-layer-visibility"><label className="ec-check"><input type="checkbox" checked={template.visible.institution} disabled={disabled} onChange={e => props.onChange({ ...template, visible: { ...template.visible, institution: e.target.checked } })} /> Asal sekolah / instansi</label><label className="ec-check"><input type="checkbox" checked={template.visible.number} disabled={disabled} onChange={e => props.onChange({ ...template, visible: { ...template.visible, number: e.target.checked } })} /> Nomor sertifikat</label>
                {Object.entries(template.identityFields || {}).map(([key, value]) => <label className="ec-check" key={key}><input type="checkbox" disabled={disabled} checked={value.visible} onChange={e => props.onChange({ ...template, identityFields: { ...template.identityFields, [key]: { ...value, visible: e.target.checked } } })} /> {key}</label>)}</div></details>
            {active && <fieldset disabled={disabled}><legend>{active.label}</legend>
                {active.qr && <label className="ec-qr-size">Ukuran QR <output>{ptToMm(active.placement.width).toFixed(1)} mm</output><input aria-label="Ukuran QR" type="range" min={MIN_QR_MM} max={Math.max(MIN_QR_MM, ptToMm(sizeLimit))} step={.5} value={ptToMm(active.placement.width)} onChange={e => update({ width: mmToPt(Number(e.target.value)) })} /></label>}
                <details className="ec-control-details ec-position-details"><summary>Posisi & ukuran presisi</summary><div className="ec-precise-fields">{(['x', 'y', 'width'] as const).map(key => <label key={key}>{key === 'x' ? 'X (mm)' : key === 'y' ? 'Y (mm)' : active.qr ? 'Sisi QR (mm)' : 'Lebar (mm)'}<PrecisionInput key={`${active.id}:${key}`} label={key === 'x' ? 'X (mm)' : key === 'y' ? 'Y (mm)' : active.qr ? 'Sisi QR (mm)' : 'Lebar (mm)'} min={key === 'width' ? active.qr ? MIN_QR_MM : .36 : 0} max={Math.max(key === 'width' ? active.qr ? MIN_QR_MM : .36 : 0, Math.floor(ptToMm(key === 'x' ? geometry!.width - active.placement.width : key === 'y' ? geometry!.height - (active.qr ? active.placement.width : active.placement.size * 1.3) : sizeLimit) * 100) / 100)} value={Number(ptToMm(active.placement[key]).toFixed(2))} onCommit={value => update({ [key]: mmToPt(value) })} /></label>)}</div></details>
                {!active.qr && <><div className="ec-precise-fields"><label>Font (pt)<PrecisionInput key={`${active.id}:font`} label="Font elemen (pt)" min={8} max={60} step={.5} value={active.placement.size} onCommit={value => update({ size: value })} /></label><label>Warna<input type="color" value={active.placement.color} onChange={e => update({ color: e.target.value })} /></label></div><label>Rata teks<select value={active.placement.align} onChange={e => update({ align: e.target.value as TextPlacement['align'] })}><option value="left">Kiri</option><option value="center">Tengah</option><option value="right">Kanan</option></select></label></>}
                {active.id.startsWith('identity:') && <label className="ec-check"><input type="checkbox" checked={template.identityFields![active.id.slice(9)].showLabel} onChange={e => update({ showLabel: e.target.checked } as Partial<TextPlacement>)} /> Sertakan nama kolom</label>}
                <div className="ec-actions"><button className="ec-text-button" onClick={() => update({ x: (geometry!.width - active.placement.width) / 2 })}>Tengahkan horizontal</button><button className="ec-text-button" onClick={() => update({ y: (geometry!.height - (active.qr ? active.placement.width : active.placement.size * 1.3)) / 2 })}>Tengahkan vertikal</button></div>
            </fieldset>}
        </aside><div className="ec-editor-canvas-area"><div className={`ec-editor-status${error ? ' has-error' : ''}`} role="status">{error || (!geometry ? 'Memuat template…' : rendering ? 'Memperbarui…' : 'Pratinjau')}{geometry && <span>{ptToMm(geometry.width).toFixed(0)} × {ptToMm(geometry.height).toFixed(0)} mm</span>}</div>
            <div ref={viewportRef} className="ec-editor-viewport"><div className="ec-editor-stage" ref={stageRef} tabIndex={0} role="group" aria-label="Area penempatan sertifikat" style={{ width: geometry ? geometry.width * scale : '100%', height: geometry ? geometry.height * scale : 360 }}
                onKeyDown={e => { if (!active || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return; e.preventDefault(); const step = mmToPt(e.altKey ? .01 : e.shiftKey ? 1 : .1); update({ x: active.placement.x + (e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0), y: active.placement.y + (e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0) }); }}
                onPointerDown={e => { if (disabled || !active || e.button !== 0 || e.target !== e.currentTarget) return; tap.current = { x: e.clientX, y: e.clientY, pointer: e.pointerId }; e.currentTarget.focus({ preventScroll: true }); }}
                onPointerMove={e => { const sizing = resize.current; if (sizing && geometry && e.pointerId === sizing.pointer) { update({ width: resizeLayerWidth(sizing.placement, geometry, (e.clientX - sizing.startX) / sizing.scale, (e.clientY - sizing.startY) / sizing.scale, sizing.qr) }, sizing.id); return; } if (tap.current && Math.hypot(e.clientX - tap.current.x, e.clientY - tap.current.y) > 4) tap.current = null; const item = drag.current; if (!item || e.pointerId !== item.pointer) return; update({ x: item.x + (e.clientX - item.startX) / item.scale, y: item.y + (e.clientY - item.startY) / item.scale }, item.id); }}
                onPointerUp={e => { if (tap.current?.pointer === e.pointerId) { const rect = e.currentTarget.getBoundingClientRect(); update({ x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale }); } tap.current = null; drag.current = null; resize.current = null; }} onPointerCancel={() => { tap.current = null; drag.current = null; resize.current = null; }}>
                <canvas ref={canvasRef} aria-hidden="true" />{grid && <div className="ec-editor-grid" style={{ backgroundSize: `${mmToPt(5) * scale}px ${mmToPt(5) * scale}px` }} />}
                {layers.map(layer => <button type="button" key={layer.id} title={layer.label} aria-label={`Posisi ${layer.label}`} aria-pressed={active?.id === layer.id} disabled={disabled} className={`ec-editor-layer${active?.id === layer.id ? ' is-selected' : ''}${layer.qr ? ' is-qr' : ''}`} style={{ left: layer.placement.x * scale, top: layer.placement.y * scale, width: layer.placement.width * scale, height: (layer.qr ? layer.placement.width : layer.placement.size * 1.3) * scale }}
                    onPointerDown={e => { if (disabled || e.button !== 0) return; e.preventDefault(); e.stopPropagation(); setSelected(layer.id); stageRef.current?.focus({ preventScroll: true }); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { id: layer.id, startX: e.clientX, startY: e.clientY, x: layer.placement.x, y: layer.placement.y, scale, pointer: e.pointerId }; }} onClick={() => selectLayer(layer.id)}><span>{layer.label}</span></button>)}
                {active && <button type="button" className={`ec-resize-handle${active.qr ? ' is-qr' : ''}`} disabled={disabled} aria-label={active.qr ? 'Ubah ukuran QR' : `Ubah lebar ${active.label}`} title={active.qr ? 'Tarik untuk mengubah ukuran QR' : 'Tarik untuk mengubah lebar teks'} style={{ left: (active.placement.x + active.placement.width) * scale - 8, top: (active.placement.y + (active.qr ? active.placement.width : active.placement.size * .65)) * scale - 8 }}
                    onPointerDown={e => { if (disabled || e.button !== 0) return; e.preventDefault(); e.stopPropagation(); tap.current = null; drag.current = null; e.currentTarget.setPointerCapture(e.pointerId); resize.current = { id: active.id, startX: e.clientX, startY: e.clientY, scale, pointer: e.pointerId, placement: { ...active.placement }, qr: !!active.qr }; }}
                    onKeyDown={e => { if (!geometry || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return; e.preventDefault(); e.stopPropagation(); const delta = mmToPt(e.shiftKey ? 1 : .1) * (['ArrowLeft', 'ArrowDown'].includes(e.key) ? -1 : 1); update({ width: resizeLayerWidth(active.placement, geometry, delta, delta, active.qr) }); }} />}
            </div></div>
        </div></div>
    </div>;
}
