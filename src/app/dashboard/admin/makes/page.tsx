'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function MakesAdminPage() {
  const [makes, setMakes]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string|null>(null)
  const [makeName, setMakeName] = useState('')
  const [saving, setSaving]   = useState(false)
  const supabase = createClient()

  async function load() {
    const { data } = await supabase.from('instrument_makes').select('*').order('make')
    setMakes(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function startNew() { setEditing(null); setMakeName(''); setShowForm(true) }
  function startEdit(m: any) { setEditing(m.id); setMakeName(m.make); setShowForm(true) }

  async function save() {
    if (!makeName.trim()) return alert('Make name is required.')
    setSaving(true)
    if (editing) {
      await supabase.from('instrument_makes').update({ make: makeName.trim() }).eq('id', editing)
    } else {
      await supabase.from('instrument_makes').insert({ make: makeName.trim() })
    }
    setSaving(false); setShowForm(false); setEditing(null); setMakeName(''); load()
  }

  async function toggleActive(m: any) {
    await supabase.from('instrument_makes').update({ active: !m.active }).eq('id', m.id)
    load()
  }

  async function deleteMake(id: string) {
    if (!confirm('Delete this make? This may affect existing models.')) return
    await supabase.from('instrument_makes').delete().eq('id', id)
    load()
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Instrument makes</h1>
          <p className="text-gray-500 text-sm mt-1">Manage manufacturer names used across instrument models</p>
        </div>
        <button onClick={startNew} className="btn-primary">+ Add make</button>
      </div>

      {showForm && (
        <div className="card p-5 mb-5">
          <h2 className="font-semibold text-gray-900 mb-4">{editing ? 'Edit make' : 'New make'}</h2>
          <div className="mb-4">
            <label className="label">Manufacturer name *</label>
            <input
              className="input"
              value={makeName}
              onChange={e => setMakeName(e.target.value)}
              placeholder="e.g. Eurotron, Crowcon, GMI..."
              onKeyDown={e => e.key === 'Enter' && save()}
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <button onClick={save} disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : editing ? 'Update' : 'Save'}
            </button>
            <button onClick={() => { setShowForm(false); setEditing(null) }} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-center text-gray-400 text-sm">Loading...</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase bg-gray-50">
                <th className="px-5 py-3 text-left">Make</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {makes.map(m => (
                <tr key={m.id} className={`hover:bg-gray-50 ${m.active === false ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-3 font-medium text-gray-900">{m.make}</td>
                  <td className="px-5 py-3">
                    {m.active !== false
                      ? <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">Active</span>
                      : <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">Disabled</span>}
                  </td>
                  <td className="px-5 py-3 text-right space-x-3">
                    <button onClick={() => startEdit(m)} className="text-xs text-brand-500 hover:underline">Edit</button>
                    <button onClick={() => toggleActive(m)} className="text-xs text-amber-500 hover:underline">
                      {m.active === false ? 'Enable' : 'Disable'}
                    </button>
                    <button onClick={() => deleteMake(m.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
              {makes.length === 0 && (
                <tr><td colSpan={3} className="px-5 py-8 text-center text-gray-400 text-sm">No makes yet — click "+ Add make" to get started.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
