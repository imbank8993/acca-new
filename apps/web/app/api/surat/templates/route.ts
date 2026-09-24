import { NextRequest, NextResponse } from 'next/server'
import { nestFetchAsUser } from '@/lib/nest-api'
import { extractRequestToken } from '@/lib/app-jwt'
import { clearTemplateCache } from '@/lib/print'
import { deleteFile } from '@/lib/storage'

export async function GET(req: NextRequest) {
  try {
    const token = extractRequestToken(req)
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { status, body } = await nestFetchAsUser('/surat/templates', token, { method: 'GET' })
    return NextResponse.json(body, { status })
  } catch (e: any) {
    console.error('[GET /api/surat/templates]', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = extractRequestToken(req)
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const contentType = req.headers.get('content-type') || ''
    let jenis_surat: string
    let template_html: string
    let nama_template: string

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File
      const type = formData.get('type') as string

      if (!file || !type) {
        return NextResponse.json({ ok: false, error: 'File dan tipe diperlukan' }, { status: 400 })
      }

      const ext = file.name.split('.').pop()?.toLowerCase()

      if (ext === 'docx') {
        const uploadFormData = new FormData()
        uploadFormData.append('file', file)
        uploadFormData.append('folder', 'Template Surat')

        const uploadRes = await fetch(new URL('/api/upload', req.url).toString(), {
          method: 'POST',
          headers: {
            cookie: req.headers.get('cookie') || '',
          },
          body: uploadFormData,
        })

        const uploadJson = await uploadRes.json()

        if (!uploadRes.ok || !uploadJson.ok || !uploadJson.publicUrl) {
          return NextResponse.json(
            { ok: false, error: uploadJson.error || 'Upload file gagal' },
            { status: 500 }
          )
        }

        template_html = uploadJson.publicUrl
        nama_template = file.name.replace(/\.docx$/i, '')
        jenis_surat = type
      } else if (ext === 'html' || ext === 'htm') {
        const fileContent = await file.text()
        template_html = fileContent
        nama_template = file.name.replace(/\.(html|htm)$/i, '')
        jenis_surat = type
      } else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext || '')) {
        const allowedImageTypes = ['MENINGGALKAN_ASRAMA', 'REKOMENDASI_KONTROL', 'REKAM_MEDIK']
        if (!allowedImageTypes.includes(type)) {
          return NextResponse.json(
            { ok: false, error: 'File gambar hanya diizinkan untuk: Surat Izin Meninggalkan Asrama, Rekomendasi, Rekam Medik' },
            { status: 400 }
          )
        }
        const uploadFormData = new FormData()
        uploadFormData.append('file', file)
        uploadFormData.append('folder', 'Template Surat')

        const uploadRes = await fetch(new URL('/api/upload', req.url).toString(), {
          method: 'POST',
          headers: {
            cookie: req.headers.get('cookie') || '',
          },
          body: uploadFormData,
        })

        const uploadJson = await uploadRes.json()

        if (!uploadRes.ok || !uploadJson.ok || !uploadJson.publicUrl) {
          return NextResponse.json(
            { ok: false, error: uploadJson.error || 'Upload file gagal' },
            { status: 500 }
          )
        }

        template_html = uploadJson.publicUrl
        nama_template = file.name.replace(/\.[^.]+$/i, '')
        jenis_surat = type
      } else {
        return NextResponse.json(
          { ok: false, error: 'Hanya file .docx, .html, .htm, atau gambar (.png/.jpg/.jpeg/.webp/.gif) yang diizinkan' },
          { status: 400 }
        )
      }
    } else {
      const body = await req.json()
      jenis_surat = body.jenis_surat
      template_html = body.template_html || ''
      nama_template = body.nama_template || jenis_surat

      if (!jenis_surat) {
        return NextResponse.json({ ok: false, error: 'jenis_surat diperlukan' }, { status: 400 })
      }
    }

    // Proxy the resolved metadata/html to NestJS
    const { status, body } = await nestFetchAsUser('/surat/templates', token, {
      method: 'POST',
      body: JSON.stringify({ jenis_surat, template_html, nama_template })
    })

    if (body?.ok && body.old_html?.startsWith('http') && body.old_html !== template_html) {
      try { await deleteFile(body.old_html) } catch (err) {
        console.error('Gagal hapus file template lama dari storage:', err)
      }
    }

    // Invalidate the template in-memory cache
    clearTemplateCache()

    return NextResponse.json(body, { status })
  } catch (e: any) {
    console.error('[POST /api/surat/templates]', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
