/**
 * DOCX Generator
 * Uses docxtemplater to render a .docx template with data.
 *
 * Handles two kinds of templates:
 *   - Plain text templates: tags like {{nama}}, {{hari_range}}
 *   - Background-image templates: a .docx with an embedded image as the "background",
 *     overlaid with text tags (w:nama, w:hari_range, etc.)
 */

import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import Swal from 'sweetalert2';

// @ts-ignore
import ImageModule from 'docxtemplater-image-module-free';

/**
 * Options for the DOCX generator.
 */
export interface DocxGenerateOptions {
  /**
   * Public URL or relative path to the .docx template file.
   * Example: '/templates/template_surat_izin_pribadi.docx'
   */
  templateUrl: string;
  /** Key-value pairs that fill the docxtemplater tags */
  data: Record<string, unknown>;
  /** Downloaded file name (without extension) */
  outputFilename: string;
  /**
   * QR code image URL — embedded in the template via the image module.
   * If provided, docxtemplater will fetch and embed it automatically.
   * Pass the raw /api/qrcode?... URL (the proxy will handle CORS).
   */
  qrCodeUrl?: string;
}

/**
 * Build the docxtemplater image module configured to proxy external image URLs.
 *
 * The module maps image tags (like `qr_code`) to pixel dimensions and fetches
 * each image through /api/proxy-image so CORS restrictions are bypassed.
 */
function buildImageModule(qrCodeUrl?: string) {
  return new ImageModule({
    centered: false,
    // Map template tag names → pixel dimensions.
    // Provide specific size for QR codes (1.5cm ≈ 57px at 96dpi).
    getImage: async (tagValue: string) => {
      if (!tagValue || typeof tagValue !== 'string') {
        return null;
      }

      // Accept both raw URLs and proxy-prefixed URLs
      let imageUrl = tagValue.startsWith('http') ? tagValue : tagValue;
      if (!imageUrl.startsWith('http')) {
        return null;
      }

      // Proxy external images through our CORS proxy
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
      try {
        const res = await fetch(proxyUrl);
        if (!res.ok) {
          console.warn('[docx-gen] Image proxy failed:', res.status, imageUrl);
          return null;
        }
        return await res.arrayBuffer();
      } catch (e) {
        console.error('[docx-gen] Image proxy error:', imageUrl, e);
        return null;
      }
    },
    // QR codes are small (≈ 57×57px); adjust per template if needed
    getSize: (tagName: string) => {
      if (qrCodeUrl && tagName === 'qr_code') {
        return [57, 57]; // 1.5cm × 1.5cm at 96dpi
      }
      return [0, 0]; // docxtemplater reads natural size from the binary
    },
  });
}

/**
 * Fetch a URL and return the ArrayBuffer.
 * External URLs are routed through /api/proxy-docx to bypass CORS.
 */
async function fetchTemplate(url: string): Promise<ArrayBuffer> {
  let fetchUrl: string;

  try {
    const u = new URL(url);
    fetchUrl = u.origin !== window.location.origin
      ? `/api/proxy-docx?url=${encodeURIComponent(url)}`
      : url;
  } catch {
    // Relative path — fetch directly
    fetchUrl = url;
  }

  const res = await fetch(fetchUrl);
  if (!res.ok) {
    throw new Error(
      `Gagal membuka template: ${url} (${res.status} ${res.statusText})`
    );
  }
  return res.arrayBuffer();
}

/**
 * Strip XML namespace prefix from a raw XML tag name.
 * e.g. "w:nama"  → "nama"
 *      "w:qr_code" → "qr_code"
 */
function stripNamespace(tag: string): string {
  const idx = tag.indexOf(':');
  return idx >= 0 ? tag.slice(idx + 1) : tag;
}

/**
 * Render a docxtemplater .docx template and trigger a browser download.
 *
 * @param options  See DocxGenerateOptions
 * @throws          Will display a SweetAlert2 error on failure.
 */
export async function generateDocx(options: DocxGenerateOptions): Promise<void> {
  const { templateUrl, data, outputFilename, qrCodeUrl } = options;

  try {
    // 1. Fetch template binary
    const arrayBuffer = await fetchTemplate(templateUrl);

    // 2. Load into PizZip
    const zip = new PizZip(arrayBuffer);

    // 3. Image module — proxy-aware for QR codes / background images
    const imageModule = buildImageModule(qrCodeUrl);

    // 4. Pre-process data: strip XML namespaces from keys so template tags
    //    like {{w:nama}} resolve to data['nama'].
    //    Also inject QR code URL if provided.
    const processedData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      processedData[stripNamespace(key)] = value;
    }
    if (qrCodeUrl) {
      processedData['qr_code'] = qrCodeUrl;
    }

    // 5. Create Docxtemplater instance
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      modules: [imageModule],
      // Ensure tags like {w:nama} in the XML are parsed as 'nama'
      parser: (tag: string) => ({
        get: (scope: any) => {
          const stripped = stripNamespace(tag);
          return scope[stripped];
        },
      }),
    });

    // 6. Render async (required when images are involved)
    await doc.renderAsync(processedData);

    // 7. Generate output blob
    const blob = doc.getZip().generate({
      type: 'blob',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    // 8. Save file
    saveAs(blob, `${outputFilename}.docx`);
  } catch (error: unknown) {
    console.error('[docx-gen] Error:', error);

    if (error instanceof Error) {
      // Docxtemplater-specific error formatting
      const err = error as { properties?: { errors?: Array<{ message: string }> } };
      if (err.properties?.errors?.length) {
        const messages = err.properties.errors.map((e) => e.message).join('\n');
        Swal.fire('Error Template', `Ada masalah pada tag template Anda:\n${messages}`, 'error');
        return;
      }

      Swal.fire({
        title: 'Gagal Mencetak',
        html:
          `Terjadi kesalahan saat memproses template.<br/><br/>` +
          `<div style="text-align:left;background:#f8f9fa;padding:10px;border-radius:4px;font-family:monospace;font-size:0.75rem;border:1px solid #ddd;">` +
          `<b>Error:</b> ${error.message}<br/>` +
          `<b>Path:</b> ${templateUrl}</div>`,
        icon: 'error',
      });
    }
  }
}
