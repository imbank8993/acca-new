import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { copyFile, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { basename, dirname, join, resolve } from 'path';
import sharp = require('sharp');
import { createWorker, OEM, PSM, Worker } from 'tesseract.js';
import { parseReceiptLines, tsvLines } from './receipt-ocr-parser';
import { ReceiptFields } from './payment-rules';

@Injectable()
export class LocalReceiptOcr {
  private active = 0;
  available() {
    try {
      for (const code of ['eng', 'ind']) require.resolve(`@tesseract.js-data/${code}/4.0.0_best_int/${code}.traineddata.gz`);
      require.resolve('tesseract.js-core');
      return true;
    } catch { return false; }
  }
  async extract(image: Buffer): Promise<ReceiptFields> {
    if (this.active >= 2) throw new ServiceUnavailableException('Pembaca bukti sedang digunakan. Silakan coba kembali sebentar lagi.');
    this.active++;
    let worker: Worker | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let expired = false;
    let languageDir: string | undefined;
    let settled: Promise<void> | undefined;
    const cleanup = async () => {
      if (worker) { await worker.terminate().catch(() => {}); worker = undefined; }
      if (languageDir && resolve(dirname(languageDir)) === resolve(tmpdir()) && basename(languageDir).startsWith('acca-receipt-languages-')) {
        await rm(languageDir, { recursive: true, force: true }).catch(() => {});
        languageDir = undefined;
      }
    };
    try {
      const work = async () => {
        let png: Buffer;
        try {
          const pipeline = sharp(image, { limitInputPixels: 20000000, animated: false });
          const metadata = await pipeline.metadata();
          if ((metadata.pages || 1) > 1) throw new Error('Multi-page image');
          png = await pipeline.rotate().resize({ width: Math.min(2000, Math.max(1200, metadata.width || 1200)), height: 4000, fit: 'inside' }).flatten({ background: '#ffffff' }).grayscale().normalize().sharpen().png().toBuffer();
        } catch { throw new BadRequestException('Gambar tidak dapat dibaca atau resolusinya terlalu besar. Gunakan satu gambar bukti yang jelas.'); }
        if (expired) throw new Error('Timed out');
        // Tesseract expects all languages in one directory. Copy only the bundled
        // model files, never receipt images, and disable its download/cache path.
        languageDir = await mkdtemp(join(tmpdir(), 'acca-receipt-languages-'));
        await Promise.all(['eng', 'ind'].map(code => copyFile(require.resolve(`@tesseract.js-data/${code}/4.0.0_best_int/${code}.traineddata.gz`), join(languageDir!, `${code}.traineddata.gz`))));
        if (expired) throw new Error('Timed out');
        worker = await createWorker('eng+ind', OEM.LSTM_ONLY, { langPath: languageDir, cacheMethod: 'none', logger: () => {}, errorHandler: () => {} });
        if (expired) { await cleanup(); throw new Error('Timed out'); }
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: '1', user_defined_dpi: '300' });
        const first = await worker.recognize(png, {}, { text: true, tsv: true });
        let fields = parseReceiptLines(tsvLines(first.data.tsv || ''));
        if (fields.reviewRequired || fields.amount === null || !fields.account) {
          await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
          const second = await worker.recognize(png, {}, { text: true, tsv: true });
          const alternate = parseReceiptLines(tsvLines(second.data.tsv || ''));
          const conservativeStatus = fields.status === 'failed' || alternate.status === 'failed' ? 'failed' : fields.status === 'pending' || alternate.status === 'pending' ? 'pending' : null;
          // Disagreement between two layouts must not become an automatic payment.
          const conflicts = (['amount', 'account', 'bank', 'status'] as const).some(k => fields[k] && alternate[k] && fields[k] !== 'unknown' && alternate[k] !== 'unknown' && fields[k] !== alternate[k]);
          const score = (f: ReceiptFields) => Number(!!f.amount) * 3 + Number(!!f.account) * 2 + Number(!!f.bank) + Number(f.status !== 'unknown') + Number(!!f.recipient);
          if (score(alternate) > score(fields) || (score(alternate) === score(fields) && !alternate.reviewRequired)) fields = alternate;
          if (conservativeStatus) fields = { ...fields, status: conservativeStatus };
          if (conflicts) fields = { ...fields, reviewRequired: true, warnings: [...(fields.warnings || []), 'Hasil pembacaan berbeda; periksa bukti asli'] };
        }
        return fields;
      };
      const job = work().finally(async () => { if (expired) await cleanup(); });
      settled = job.then(() => undefined, () => undefined);
      return await Promise.race([job, new Promise<never>((_, reject) => {
        timer = setTimeout(() => { expired = true; reject(new ServiceUnavailableException('Pembacaan bukti terlalu lama. Gunakan gambar yang lebih jelas atau coba kembali.')); }, 60000);
      })]);
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException('Pembacaan bukti lokal gagal. Silakan coba kembali dengan gambar yang lebih jelas.');
    } finally {
      if (timer) clearTimeout(timer);
      // If startup outlasts the deadline, let its late completion clean up its
      // assets; removing them while it initializes could leave a broken worker.
      if (worker || !expired) await cleanup();
      if (expired && settled) {
        // Pekerjaan yang kehabisan waktu masih berjalan sampai worker berhenti. Slotnya
        // baru dilepas setelah itu (paling lambat 30 detik), supaya batas dua OCR tetap berlaku.
        let released = false;
        const release = () => { if (!released) { released = true; this.active--; } };
        void settled.then(release);
        setTimeout(release, 30000).unref?.();
      } else {
        this.active--;
      }
    }
  }
}
