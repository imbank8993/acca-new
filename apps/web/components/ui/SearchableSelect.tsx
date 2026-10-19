'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { RiArrowDropDownFill } from 'react-icons/ri'

export interface Option {
  value: string | number
  label: string
  subLabel?: string
}

export interface SearchableSelectProps {
  options: Option[]
  value: string | number | (string | number)[]
  onChange: (value: string | number | (string | number)[]) => void
  placeholder?: string
  label?: string
  className?: string
  disabled?: boolean
  multiple?: boolean
  placement?: 'top' | 'bottom'
  itemLabel?: string
  showQuickActions?: boolean
  creatable?: boolean
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Pilih...',
  label,
  className = '',
  disabled = false,
  multiple = false,
  placement = 'bottom',
  itemLabel = 'item',
  showQuickActions = true,
  creatable = false
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setSearch('')
        setIsOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSearch('')
        setIsOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const selectedOptions = useMemo(() => {
    if (multiple) {
      const values = Array.isArray(value) ? value : []
      const matched = options.filter((opt) => values.includes(opt.value))
      if (creatable) {
        const matchedVals = new Set(matched.map(m => m.value))
        const custom = values
          .filter(v => v !== '' && v !== null && v !== undefined && !matchedVals.has(v))
          .map(v => ({ value: v, label: String(v), subLabel: '(Ketik manual)' }))
        return [...matched, ...custom]
      }
      return matched
    } else {
      const found = options.find((opt) => opt.value === value)
      if (found) return [found]
      if (creatable && value !== '' && value !== null && value !== undefined) {
        return [{ value, label: String(value), subLabel: '(Ketik manual)' }]
      }
      return []
    }
  }, [options, value, multiple, creatable])

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) || (opt.subLabel && opt.subLabel.toLowerCase().includes(q))
    )
  }, [options, search])

  const isExactMatch = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return false
    return options.some(
      opt => opt.label.toLowerCase() === q || String(opt.value).toLowerCase() === q
    )
  }, [options, search])

  const toggle = (e: React.MouseEvent) => {
    if (disabled) return
    if (!isOpen) {
      setIsOpen(true)
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      if ((e.target as HTMLElement).tagName !== 'INPUT') {
        setSearch('')
        setIsOpen(false)
      }
    }
  }

  const pick = (opt: Option) => {
    if (multiple) {
      const currentValues = Array.isArray(value) ? value : []
      const isSelected = currentValues.includes(opt.value)

      let newValues: (string | number)[]
      if (isSelected) {
        newValues = currentValues.filter(v => v !== opt.value)
      } else {
        newValues = [...currentValues, opt.value]
      }

      onChange(newValues)
      inputRef.current?.focus()
    } else {
      onChange(opt.value)
      setSearch('')
      setIsOpen(false)
    }
  }

  const pickCustom = (customText: string) => {
    const clean = customText.trim()
    if (!clean) return
    if (multiple) {
      const current = Array.isArray(value) ? value : []
      if (!current.includes(clean)) {
        onChange([...current, clean])
      }
      setSearch('')
      inputRef.current?.focus()
    } else {
      onChange(clean)
      setSearch('')
      setIsOpen(false)
    }
  }

  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    const allVals = options.map(o => o.value)
    onChange(allVals)
    inputRef.current?.focus()
  }

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange([])
    inputRef.current?.focus()
  }

  const dynamicPlaceholder = useMemo(() => {
    if (selectedOptions.length === 0) return placeholder
    if (multiple) {
      const summary = selectedOptions.map(o => o.label).join(', ')
      return `${selectedOptions.length} ${itemLabel} terpilih (${summary})`
    }
    return selectedOptions[0].label
  }, [selectedOptions, placeholder, multiple, itemLabel])

  return (
    <div
      ref={wrapperRef}
      className={`ss ${disabled ? 'ss--disabled' : ''} ${className}`}
      aria-disabled={disabled}
    >
      {label && <label className="ss__label">{label}</label>}

      {/* Main Input & Trigger Box */}
      <div
        className={`ss__trigger ${isOpen ? 'is-open' : ''}`}
        onClick={toggle}
      >
        {multiple && selectedOptions.length > 0 && !search && (
          <span className="ss__badge">{selectedOptions.length}</span>
        )}

        <input
          ref={inputRef}
          type="text"
          className="ss__mainInput"
          placeholder={dynamicPlaceholder}
          value={search}
          disabled={disabled}
          onChange={(e) => {
            setSearch(e.target.value)
            if (!isOpen) setIsOpen(true)
          }}
          onFocus={() => {
            if (!isOpen) setIsOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (creatable && search.trim()) {
                e.preventDefault()
                pickCustom(search.trim())
              } else if (filteredOptions.length > 0) {
                e.preventDefault()
                pick(filteredOptions[0])
              }
            }
          }}
        />

        <div className="ss__triggerActions">
          {search ? (
            <button
              type="button"
              className="ss__clearBtn"
              title="Hapus ketikan"
              onClick={(e) => {
                e.stopPropagation()
                setSearch('')
                inputRef.current?.focus()
              }}
            >
              <i className="bi bi-x-circle-fill" />
            </button>
          ) : !multiple && value && !disabled ? (
            <button
              type="button"
              className="ss__clearBtn ss__clearBtn--value"
              title="Kosongkan pilihan"
              onClick={(e) => {
                e.stopPropagation()
                onChange('')
                setSearch('')
              }}
            >
              <i className="bi bi-x" style={{ fontSize: '1.15rem' }} />
            </button>
          ) : null}

          <RiArrowDropDownFill
            size={20}
            className={`ss__chev ${isOpen ? 'rot' : ''}`}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className={`ss__drop ${placement === 'top' ? 'ss__drop--top' : ''}`} role="listbox">
          {multiple && showQuickActions && options.length > 0 && (
            <div className="ss__quickActions">
              <button
                type="button"
                className="ss__quickBtn"
                onClick={handleSelectAll}
              >
                <i className="bi bi-check-all" /> Pilih Semua
              </button>
              <span className="ss__quickDivider">|</span>
              <button
                type="button"
                className="ss__quickBtn ss__quickBtn--clear"
                onClick={handleClearAll}
              >
                <i className="bi bi-x-circle" /> Kosongkan
              </button>
            </div>
          )}

          <div className="ss__list">
            {creatable && search.trim() && !isExactMatch && (
              <button
                type="button"
                className="ss__item ss__item--creatable"
                onClick={(e) => {
                  e.stopPropagation()
                  pickCustom(search.trim())
                }}
              >
                <div className="ss__itemContent" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="bi bi-pencil-square" style={{ color: '#2563eb', fontSize: '1.05rem', flexShrink: 0 }} />
                  <div>
                    <div className="ss__itemMain" style={{ color: '#2563eb', fontWeight: 600 }}>
                      Gunakan: "{search.trim()}"
                    </div>
                    <div className="ss__itemSub" style={{ color: '#64748b', fontSize: '0.72rem' }}>
                      Tekan Enter atau klik untuk memilih teks ini
                    </div>
                  </div>
                </div>
              </button>
            )}

            {filteredOptions.length === 0 && (!creatable || !search.trim()) ? (
              <div className="ss__empty">
                <i className="bi bi-inbox" />
                <span>Tidak ada data yang cocok</span>
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const active = multiple
                  ? (Array.isArray(value) ? value : []).includes(opt.value)
                  : opt.value === value
                return (
                  <button
                    type="button"
                    key={opt.value}
                    className={`ss__item ${active ? 'is-active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      pick(opt)
                    }}
                  >
                    {multiple && (
                      <span className={`ss__checkbox ${active ? 'is-checked' : ''}`}>
                        {active && <i className="bi bi-check-lg" />}
                      </span>
                    )}
                    <div className="ss__itemContent">
                      <span className="ss__itemMain">{opt.label}</span>
                      {opt.subLabel && <span className="ss__itemSub">{opt.subLabel}</span>}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .ss {
          width: 100%;
          min-width: 0;
          position: relative;
        }

        .ss--disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .ss__label {
          display: block;
          margin: 0 0 6px;
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--n-ink, rgba(15, 23, 42, 0.8));
        }

        /* Main Trigger Box */
        .ss__trigger {
          width: 100%;
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 8px;

          padding: 7px 10px 7px 12px;
          border-radius: 10px;
          border: 1.5px solid var(--n-border, #cbd5e1);
          background: var(--n-card, #ffffff);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);

          cursor: text;
          transition: all 0.15s ease;
        }

        .ss__trigger:hover:not(.ss--disabled) {
          border-color: var(--n-primary, #3b82f6);
        }

        .ss__trigger.is-open {
          border-color: var(--n-primary, #3b82f6);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }

        .ss__badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          border-radius: 999px;
          font-size: 0.72rem;
          font-weight: 700;
          background: rgba(59, 130, 246, 0.14);
          color: var(--n-primary, #3b82f6);
          flex-shrink: 0;
        }

        .ss__mainInput {
          flex: 1;
          min-width: 0;
          border: none;
          background: transparent;
          outline: none;
          font-size: 0.83rem;
          font-weight: 500;
          color: var(--n-ink, #0f172a);
          padding: 2px 0;
        }

        .ss__mainInput::placeholder {
          color: #64748b;
          font-weight: 400;
        }

        .ss__triggerActions {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .ss__clearBtn {
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 2px;
          font-size: 0.95rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.12s;
        }
        .ss__clearBtn:hover {
          color: #ef4444;
        }

        /* Solid triangle icon matching InlineSelect */
        .ss__chev {
          color: #64748b;
          transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), color 0.15s ease;
          pointer-events: none;
        }

        .ss__chev.rot {
          transform: rotate(180deg);
          color: var(--n-primary, #3b82f6);
        }

        /* Dropdown Panel */
        .ss__drop {
          position: absolute;
          z-index: 10000;
          width: 100%;
          margin-top: 6px;

          background: var(--n-card, #ffffff);
          border: 1px solid var(--n-border, rgba(148, 163, 184, 0.3));
          border-radius: 12px;
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.12), 0 4px 10px rgba(0, 0, 0, 0.04);

          overflow: hidden;
          animation: fadeIn 0.12s ease-out;
        }

        .ss__drop--top {
          bottom: 100%;
          margin-top: 0;
          margin-bottom: 6px;
        }

        .ss__quickActions {
          padding: 7px 12px;
          background: var(--n-soft, #f8fafc);
          border-bottom: 1px solid var(--n-border, rgba(148, 163, 184, 0.2));
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.75rem;
        }

        .ss__quickBtn {
          background: none;
          border: none;
          color: var(--n-primary, #3b82f6);
          font-weight: 600;
          cursor: pointer;
          padding: 2px 4px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          border-radius: 4px;
          transition: background 0.12s;
        }
        .ss__quickBtn:hover {
          background: rgba(59, 130, 246, 0.08);
        }
        .ss__quickBtn--clear {
          color: #64748b;
        }
        .ss__quickBtn--clear:hover {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.08);
        }

        .ss__quickDivider {
          color: #cbd5e1;
        }

        .ss__list {
          max-height: 220px;
          overflow-y: auto;
          padding: 4px 0;
        }

        .ss__empty {
          padding: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          font-size: 0.82rem;
          color: #94a3b8;
        }
        .ss__empty i {
          font-size: 1.3rem;
        }

        .ss__item {
          width: 100%;
          padding: 9px 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          background: transparent;
          border: none;
          border-bottom: 1px solid rgba(148, 163, 184, 0.08);
          text-align: left;
          cursor: pointer;
          transition: background 0.12s;
        }

        .ss__item:last-child {
          border-bottom: none;
        }

        .ss__item:hover {
          background: rgba(59, 130, 246, 0.06);
        }

        .ss__item.is-active {
          background: rgba(59, 130, 246, 0.10);
        }

        .ss__item--creatable {
          background: rgba(37, 99, 235, 0.05);
          border-bottom: 1.5px dashed rgba(37, 99, 235, 0.25);
        }
        .ss__item--creatable:hover {
          background: rgba(37, 99, 235, 0.12);
        }

        .ss__clearBtn--value {
          color: #94a3b8;
          opacity: 0.7;
          border-radius: 50%;
          transition: all 0.15s ease;
        }
        .ss__clearBtn--value:hover {
          opacity: 1;
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
        }

        .ss__checkbox {
          width: 18px;
          height: 18px;
          border-radius: 4px;
          border: 1.5px solid #cbd5e1;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.12s;
          font-size: 11px;
          color: white;
        }

        .ss__checkbox.is-checked {
          background: var(--n-primary, #3b82f6);
          border-color: var(--n-primary, #3b82f6);
        }

        .ss__itemContent {
          display: flex;
          flex-direction: column;
          gap: 1px;
          min-width: 0;
        }

        .ss__itemMain {
          font-size: 0.82rem;
          font-weight: 500;
          color: var(--n-ink, #0f172a);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ss__itemSub {
          font-size: 0.74rem;
          color: #64748b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Dark mode overrides */
        :global(.dark) .ss__trigger {
          background: #0b1329 !important;
          border: 1px solid rgba(59, 130, 246, 0.35) !important;
        }
        :global(.dark) .ss__mainInput {
          color: #f1f5f9 !important;
        }
        :global(.dark) .ss__mainInput::placeholder {
          color: #94a3b8 !important;
        }
        :global(.dark) .ss__badge {
          background: rgba(59, 130, 246, 0.25) !important;
          color: #93c5fd !important;
        }
        :global(.dark) .ss__chev {
          color: #60a5fa !important;
        }
        :global(.dark) .ss__drop {
          background: #0b1329 !important;
          border: 1px solid rgba(26, 115, 232, 0.4) !important;
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6) !important;
        }
        :global(.dark) .ss__quickActions {
          background: rgba(26, 115, 232, 0.08) !important;
          border-bottom-color: rgba(255, 255, 255, 0.1) !important;
        }
        :global(.dark) .ss__item {
          border-bottom-color: rgba(255, 255, 255, 0.05) !important;
        }
        :global(.dark) .ss__itemMain {
          color: #f1f5f9 !important;
        }
        :global(.dark) .ss__itemSub {
          color: #94a3b8 !important;
        }
        :global(.dark) .ss__item:hover {
          background: rgba(59, 130, 246, 0.15) !important;
        }
        :global(.dark) .ss__item.is-active {
          background: rgba(59, 130, 246, 0.22) !important;
        }
        :global(.dark) .ss__checkbox {
          border-color: rgba(255, 255, 255, 0.3) !important;
        }
        :global(.dark) .ss__checkbox.is-checked {
          background: #3b82f6 !important;
          border-color: #3b82f6 !important;
        }
        :global(.dark) .ss__quickDivider {
          color: rgba(255, 255, 255, 0.2) !important;
        }
      `}</style>
    </div>
  )
}
