import { NextRequest, NextResponse } from 'next/server'
import { nestFetchAsUser } from '@/lib/nest-api'
import { extractRequestToken } from '@/lib/app-jwt'
import { clearTemplateCache } from '@/lib/print'
import { deleteFile } from '@/lib/storage'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const token = extractRequestToken(req)
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { status, body } = await nestFetchAsUser(`/surat/templates/${id}`, token, { method: 'GET' })

    if (!body?.ok) {
      return NextResponse.json(body, { status })
    }

    const template = body.data

    if (template.template_html?.startsWith('http')) {
      return NextResponse.json(body, { status })
    }

    return new NextResponse(template.template_html || '', {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${template.nama_template || 'template'}.html"`,
      },
    })
  } catch (e: any) {
    console.error('[GET /api/surat/templates/[id]]', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const payload = await req.json()
    const token = extractRequestToken(req)
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { status, body } = await nestFetchAsUser(`/surat/templates/${id}`, token, {
      method: 'PUT',
      body: JSON.stringify(payload)
    })

    if (body?.ok) {
      clearTemplateCache()
    }

    return NextResponse.json(body, { status })
  } catch (e: any) {
    console.error('[PUT /api/surat/templates/[id]]', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const token = extractRequestToken(req)
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { status, body } = await nestFetchAsUser(`/surat/templates/${id}`, token, { method: 'DELETE' })

    if (body?.ok) {
      if (body.old_html?.startsWith('http')) {
        try { await deleteFile(body.old_html) } catch (err) {
          console.error('Gagal hapus file template dari storage:', err)
        }
      }
      clearTemplateCache()
    }

    return NextResponse.json(body, { status })
  } catch (e: any) {
    console.error('[DELETE /api/surat/templates/[id]]', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}