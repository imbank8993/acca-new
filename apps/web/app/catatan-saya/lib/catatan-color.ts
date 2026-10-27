import { WARNA_OPTIONS } from '../types'

export function catatanColor(value: string): string {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase()
  return WARNA_OPTIONS.find(option => option.value === value && value !== 'default')?.color || '#3083ff'
}
