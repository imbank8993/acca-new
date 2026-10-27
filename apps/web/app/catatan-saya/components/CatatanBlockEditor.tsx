'use client'

import React, { useCallback, useRef, KeyboardEvent } from 'react'
import { Plus, Trash2, GripVertical, CheckSquare, List, Type } from 'lucide-react'
import type { CatatanBlock } from '../types'

interface CatatanBlockEditorProps {
  blocks: CatatanBlock[]
  onChange: (blocks: CatatanBlock[]) => void
  readOnly?: boolean
}

type BlockType = CatatanBlock['type']

const BLOCK_TYPES: { type: BlockType; icon: React.ReactNode; label: string }[] = [
  { type: 'paragraph', icon: <Type size={14} />, label: 'Paragraf' },
  { type: 'checklist', icon: <CheckSquare size={14} />, label: 'Checklist' },
  { type: 'list-item', icon: <List size={14} />, label: 'Daftar' },
]

export default function CatatanBlockEditor({ blocks, onChange, readOnly = false }: CatatanBlockEditorProps) {
  const blockRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map())

  const updateBlock = useCallback((index: number, updates: Partial<CatatanBlock>) => {
    const next = blocks.map((b, i) => i === index ? { ...b, ...updates } : b)
    onChange(next)
  }, [blocks, onChange])

  const addBlock = useCallback((afterIndex: number, type: BlockType = 'paragraph') => {
    const newBlock: CatatanBlock = { type, text: '', ...(type === 'checklist' ? { checked: false } : {}) }
    const next = [...blocks]
    next.splice(afterIndex + 1, 0, newBlock)
    onChange(next)
    // Focus new block after render
    setTimeout(() => {
      blockRefs.current.get(afterIndex + 1)?.focus()
    }, 50)
  }, [blocks, onChange])

  const removeBlock = useCallback((index: number) => {
    if (blocks.length <= 1) {
      // Don't remove last block, just clear it
      onChange([{ type: 'paragraph', text: '' }])
      return
    }
    const next = blocks.filter((_, i) => i !== index)
    onChange(next)
    // Focus previous block
    setTimeout(() => {
      const focusIdx = Math.max(0, index - 1)
      blockRefs.current.get(focusIdx)?.focus()
    }, 50)
  }, [blocks, onChange])

  const changeBlockType = useCallback((index: number, newType: BlockType) => {
    const block = blocks[index]
    const updated: CatatanBlock = {
      type: newType,
      text: block.text,
      ...(newType === 'checklist' ? { checked: block.type === 'checklist' ? block.checked : false } : {}),
    }
    const next = blocks.map((b, i) => i === index ? updated : b)
    onChange(next)
  }, [blocks, onChange])

  const toggleChecked = useCallback((index: number) => {
    const block = blocks[index]
    if (block.type !== 'checklist') return
    updateBlock(index, { checked: !block.checked })
  }, [blocks, updateBlock])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>, index: number) => {
    const block = blocks[index]

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // If current block is checklist or list, add same type
      const nextType = (block.type === 'checklist' || block.type === 'list-item') ? block.type : 'paragraph'
      addBlock(index, nextType)
    }

    if (e.key === 'Backspace' && block.text === '') {
      e.preventDefault()
      removeBlock(index)
    }

    // Arrow key navigation between blocks
    if (e.key === 'ArrowUp' && index > 0) {
      const textarea = e.currentTarget
      if (textarea.selectionStart === 0) {
        e.preventDefault()
        blockRefs.current.get(index - 1)?.focus()
      }
    }
    if (e.key === 'ArrowDown' && index < blocks.length - 1) {
      const textarea = e.currentTarget
      if (textarea.selectionStart === textarea.value.length) {
        e.preventDefault()
        blockRefs.current.get(index + 1)?.focus()
      }
    }
  }, [blocks, addBlock, removeBlock])

  const autoResize = useCallback((textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto'
    textarea.style.height = textarea.scrollHeight + 'px'
  }, [])

  const setBlockRef = useCallback((index: number, el: HTMLTextAreaElement | null) => {
    if (el) {
      blockRefs.current.set(index, el)
      autoResize(el)
    } else {
      blockRefs.current.delete(index)
    }
  }, [autoResize])

  if (readOnly) {
    return (
      <div className="catatan-editor__blocks catatan-editor__blocks--readonly">
        {blocks.map((block, i) => (
          <div key={i} className={`catatan-editor__block catatan-editor__block--${block.type}`}>
            {block.type === 'checklist' && (
              <span className={`catatan-editor__checklist-box${block.checked ? ' catatan-editor__checklist-box--checked' : ''}`}>
                {block.checked ? '☑' : '☐'}
              </span>
            )}
            {block.type === 'list-item' && (
              <span className="catatan-editor__list-bullet">•</span>
            )}
            <span className={block.type === 'checklist' && block.checked ? 'catatan-editor__checklist-item--checked' : ''}>
              {block.text || '\u00A0'}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="catatan-editor__blocks">
      {blocks.map((block, index) => (
        <div key={index} className={`catatan-editor__block catatan-editor__block--${block.type}`}>
          <div className="catatan-editor__block-handle" title="Seret untuk memindahkan">
            <GripVertical size={14} />
          </div>

          {block.type === 'checklist' && (
            <button
              type="button"
              className={`catatan-editor__checklist-toggle${block.checked ? ' catatan-editor__checklist-toggle--checked' : ''}`}
              onClick={() => toggleChecked(index)}
              tabIndex={-1}
            >
              <CheckSquare size={16} />
            </button>
          )}

          {block.type === 'list-item' && (
            <span className="catatan-editor__list-bullet">•</span>
          )}

          <textarea
            ref={el => setBlockRef(index, el)}
            className={`catatan-editor__block-input${block.type === 'checklist' && block.checked ? ' catatan-editor__block-input--checked' : ''}`}
            value={block.text}
            onChange={e => {
              updateBlock(index, { text: e.target.value })
              autoResize(e.target)
            }}
            onKeyDown={e => handleKeyDown(e, index)}
            placeholder={
              block.type === 'checklist' ? 'Item checklist...' :
              block.type === 'list-item' ? 'Item daftar...' :
              'Tulis sesuatu...'
            }
            rows={1}
          />

          <div className="catatan-editor__block-toolbar">
            {BLOCK_TYPES.map(bt => (
              <button
                key={bt.type}
                type="button"
                className={`catatan-editor__block-type-btn${block.type === bt.type ? ' catatan-editor__block-type-btn--active' : ''}`}
                onClick={() => changeBlockType(index, bt.type)}
                title={bt.label}
                tabIndex={-1}
              >
                {bt.icon}
              </button>
            ))}
            <button
              type="button"
              className="catatan-editor__block-type-btn catatan-editor__block-type-btn--danger"
              onClick={() => removeBlock(index)}
              title="Hapus blok"
              tabIndex={-1}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        className="catatan-editor__add-block"
        onClick={() => addBlock(blocks.length - 1)}
      >
        <Plus size={16} />
        <span>Tambah blok</span>
      </button>
    </div>
  )
}
