'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

const emptyC = { name:'', address:'', city:'', postcode:'', contact_name:'', contact_email:'', contact_phone:'', notes:'' }
const emptyS = { name:'', address:'', city:'', postcode:'', contact_name:'', contact_email:'', contact_phone:'', notes:'' }

export default function CustomersPage() {
  const [customers, setCustomers]         = useState<any[]>([])
  const [search, setSearch]               = useState('')
  const [loading, setLoading]             = useState(true)
  const [expanded, setExpanded]           = useState<string|null>(null)
  const [showCustForm, setShowCustForm]   = useState(false)
  const [editingCust, setEditingCust]     = useState<string|null>(null)
  const [showSiteForm, setShowSiteForm]   = useState<string|null>(null)
  const [editingSite, setEditingSite]     = useState<string|null>(null)
  const [custForm, setCustForm]           = useState(emptyC)
  const [siteForm, setSiteForm]           = useState(emptyS)
  const [saving, setSaving]               = useState(false)
  const supabase = createClient()

  async function load() {
    const { data: custs } = await supabase.from('customers').select('*').order('name')
    const { data: sites } = await supabase.from('sites').select('*').order('name')
    setCustomers((custs||[]).map(c => ({ ...c, sites:(sites||[]).filter((s:any)=>s.customer_id===c.id) })))
    setLoading(false)
  }
  useEffect(()=>{ load() },[])

  const filtered = customers.filter(c => {
    const q = search.toLowerCase()
    return !q||c.name.toLowerCase().includes(q)||c.city?.toLowerCase().includes(q)||c.contact_email?.toLowerCase().includes(q)
  })

  function startNewCust() { setEditingCust(null); setCustForm(emptyC); setShowCustForm(true) }
  function startEditCust(c:any) {
    setEditingCust(c.id)
    setCustForm({ name:c.name||'', address:c.address||'', city:c.city||'', postcode:c.postcode||'', contact_name:c.contact_name||'', contact_email:c.contact_email||'', contact_phone:c.contact_phone||'', notes:c.notes||'' })
    setShowCustForm(true)
    window.scrollTo(0,0)
  }

  async function saveCustomer() {
    if (!custForm.name) return alert('Company name is required.')
    setSaving(true)
    if (editingCust) {
      const { error } = await supabase.from('customers').update(custForm).eq('id', editingCust)
      if (error) { alert(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('customers').insert(custForm)
      if (error) { alert(error.message); setSaving(false); return }
    }
    setSaving(false); setShowCustForm(false); setEditingCust(null); setCustForm(emptyC); load()
  }

  function startNewSite(customerId:string) { setEditingSite(null); setSiteForm(emptyS); setShowSiteForm(customerId) }
  function startEditSite(s:any) {
    setEditingSite(s.id)
    setSiteForm({ name:s.name||'', address:s.address||'', city:s.city||'', postcode:s.postcode||'', contact_name:s.contact_name||'', contact_email:s.contact_email||'', contact_phone:s.contact_phone||'', notes:s.notes||'' })
    setShowSiteForm(s.customer_id)
    window.scrollTo(0,0)
  }

  async function saveSite(customerId:string) {
    if (!siteForm.name) return alert('Site name is required.')
    setSaving(true)
    if (editingSite) {
      const { error } = await supabase.from('sites').update(siteForm).eq('id', editingSite)
      if (error) { alert(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('sites').insert({...siteForm, customer_id:customerId})
      if (error) { alert(error.message); setSaving(false); return }
    }
    setSaving(false); setShowSiteForm(null); setEditingSite(null); setSiteForm(emptyS); load()
  }

  async function deleteSite(sid:string) {
    if (!confirm('Delete this site?')) return
    await supabase.from('sites').delete().eq('id',sid); load()
  }

  async function deleteCustomer(cid:string) {
    if (!confirm('Delete this customer? All sites and instruments will be unlinked.')) return
    await supabase.from('customers').delete().eq('id',cid); load()
  }

  function setC(k:string,v:string){ setCustForm(f=>({...f,[k]:v})) }
  function setS(k:string,v:string){ setSiteForm(f=>({...f,[k]:v})) }

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>
          <p className="text-gray-500 text-sm mt-1">
            {customers.length} customers · {customers.reduce((a,c)=>a+(c.sites?.length??0),0)} sites
          </p>
        </div>
        <button onClick={startNewCust} className="btn-primary">+ Add customer</button>
      </div>

      {/* Customer form */}
      {showCustForm && (
        <div className="card p-5 mb-5">
          <h2 className="font-semibold text-gray-900 mb-4">{editingCust ? 'Edit customer' : 'New customer'}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Company name *</label><input className="input" value={custForm.name} onChange={e=>setC('name',e.target.value)} placeholder="e.g. United Utilities" /></div>
            <div><label className="label">Main contact name</label><input className="input" value={custForm.contact_name} onChange={e=>setC('contact_name',e.target.value)} /></div>
            <div><label className="label">Main contact email</label><input className="input" type="email" value={custForm.contact_email} onChange={e=>setC('contact_email',e.target.value)} /></div>
            <div><label className="label">Main contact phone</label><input className="input" value={custForm.contact_phone} onChange={e=>setC('contact_phone',e.target.value)} /></div>
            <div><label className="label">Head office address</label><input className="input" value={custForm.address} onChange={e=>setC('address',e.target.value)} /></div>
            <div><label className="label">City</label><input className="input" value={custForm.city} onChange={e=>setC('city',e.target.value)} /></div>
            <div><label className="label">Postcode</label><input className="input" value={custForm.postcode} onChange={e=>setC('postcode',e.target.value)} /></div>
            <div className="col-span-2"><label className="label">Notes</label><textarea className="input" rows={2} value={custForm.notes} onChange={e=>setC('notes',e.target.value)} /></div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={saveCustomer} disabled={saving} className="btn-primary">{saving?'Saving...':editingCust?'Update customer':'Save customer'}</button>
            <button onClick={()=>{setShowCustForm(false);setEditingCust(null);setCustForm(emptyC)}} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="mb-4">
        <input className="input max-w-md" placeholder="Search customers..." value={search} onChange={e=>setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="card p-8 text-center text-gray-400 text-sm">Loading...</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <div key={c.id} className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50"
                onClick={()=>setExpanded(expanded===c.id?null:c.id)}>
                <div className="flex items-center gap-4">
                  <span className="text-gray-400 text-sm">{expanded===c.id?'▼':'▶'}</span>
                  <div>
                    <div className="font-semibold text-gray-900">{c.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {c.contact_name&&<span>{c.contact_name}</span>}
                      {c.contact_email&&<span className="ml-2">{c.contact_email}</span>}
                      {c.city&&<span className="ml-2">{c.city}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className="badge-info">{c.sites?.length??0} site{c.sites?.length!==1?'s':''}</span>
                  <button onClick={e=>{e.stopPropagation();startEditCust(c)}} className="text-xs text-brand-500 hover:underline">Edit</button>
                  <button onClick={e=>{e.stopPropagation();deleteCustomer(c.id)}} className="text-xs text-red-400 hover:underline">Delete</button>
                  <Link href={`/dashboard/instruments?customer=${c.id}`} onClick={e=>e.stopPropagation()} className="text-xs text-teal-600 hover:underline">Instruments</Link>
                </div>
              </div>

              {expanded===c.id && (
                <div className="border-t border-gray-100 bg-gray-50">

                  {/* Site form */}
                  {showSiteForm===c.id && (
                    <div className="px-8 py-4 bg-white border-b border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">{editingSite?'Edit site':'Add site'} for {c.name}</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2"><label className="label">Site name *</label><input className="input" value={siteForm.name} onChange={e=>setS('name',e.target.value)} placeholder="e.g. Davyhulme Wastewater Treatment" /></div>
                        <div><label className="label">Address</label><input className="input" value={siteForm.address} onChange={e=>setS('address',e.target.value)} /></div>
                        <div><label className="label">City</label><input className="input" value={siteForm.city} onChange={e=>setS('city',e.target.value)} /></div>
                        <div><label className="label">Postcode</label><input className="input" value={siteForm.postcode} onChange={e=>setS('postcode',e.target.value)} /></div>
                        <div><label className="label">Site contact name</label><input className="input" value={siteForm.contact_name} onChange={e=>setS('contact_name',e.target.value)} /></div>
                        <div><label className="label">Site contact email</label><input className="input" type="email" value={siteForm.contact_email} onChange={e=>setS('contact_email',e.target.value)} /></div>
                        <div><label className="label">Site contact phone</label><input className="input" value={siteForm.contact_phone} onChange={e=>setS('contact_phone',e.target.value)} /></div>
                        <div className="col-span-2"><label className="label">Notes</label><textarea className="input" rows={2} value={siteForm.notes} onChange={e=>setS('notes',e.target.value)} /></div>
                      </div>
                      <div className="flex gap-3 mt-3">
                        <button onClick={()=>saveSite(c.id)} disabled={saving} className="btn-primary text-sm">{saving?'Saving...':editingSite?'Update site':'Save site'}</button>
                        <button onClick={()=>{setShowSiteForm(null);setEditingSite(null);setSiteForm(emptyS)}} className="btn-secondary text-sm">Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* Sites list */}
                  {c.sites&&c.sites.length>0 ? (
                    <div className="divide-y divide-gray-100">
                      {c.sites.map((s:any)=>(
                        <div key={s.id} className="px-8 py-3 flex items-start justify-between">
                          <div>
                            <div className="font-medium text-gray-800 text-sm">📍 {s.name}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{[s.address,s.city,s.postcode].filter(Boolean).join(', ')}</div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {s.contact_name&&<span>👤 {s.contact_name} </span>}
                              {s.contact_email&&<span>✉ {s.contact_email} </span>}
                              {s.contact_phone&&<span>📞 {s.contact_phone}</span>}
                            </div>
                          </div>
                          <div className="flex gap-3 shrink-0 ml-4">
                            <button onClick={()=>startEditSite(s)} className="text-xs text-brand-500 hover:underline">Edit</button>
                            <button onClick={()=>deleteSite(s.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                            <Link href={`/dashboard/instruments?site=${s.id}`} className="text-xs text-teal-600 hover:underline">Instruments</Link>
                            <Link href={`/dashboard/reports/new?site=${s.id}&customer=${c.id}`} className="text-xs text-gray-400 hover:underline">New report</Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-8 py-3 text-sm text-gray-400">No sites yet.</div>
                  )}

                  <div className="px-8 py-3 border-t border-gray-100">
                    <button onClick={()=>startNewSite(c.id)} className="text-sm text-brand-500 hover:underline">+ Add site</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {filtered.length===0&&(
            <div className="card p-8 text-center text-gray-400 text-sm">
              {search?'No customers match your search.':'No customers yet. Add your first one!'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}