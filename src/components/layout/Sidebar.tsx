'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import clsx from 'clsx'

const navItems = [
  { href: '/dashboard',              label: 'Dashboard',   icon: '▦' },
  { href: '/dashboard/instruments',  label: 'Instruments', icon: '⊙' },
  { href: '/dashboard/customers',    label: 'Customers',   icon: '⊞' },
  { href: '/dashboard/reports',      label: 'Reports',     icon: '☰' },
  { href: '/dashboard/alerts',       label: 'Cal Alerts',  icon: '⚑' },
      { href: '/dashboard/calls',        label: 'Call log',    icon: '📞' },
]

const adminItems = [
  { href: '/dashboard/admin/users',      label: 'Users',          icon: '◎' },
  { href: '/dashboard/admin/standards',  label: 'Ref. Standards', icon: '✓' },
  { href: '/dashboard/admin/parts',      label: 'Parts Library',  icon: '⊞' },
  { href: '/dashboard/admin/templates',  label: 'Cal Templates',  icon: '☰' },
  { href: '/dashboard/admin/models', label: 'Inst. Models', icon: '⊙' },
  { href: '/dashboard/admin/faults', label: 'Fault Types', icon: '⚠' },
]

const portalNav = [
  { href: '/portal',         label: 'My Instruments', icon: '⊙' },
  { href: '/portal/reports', label: 'My Reports',     icon: '☰' },
]

export default function Sidebar({ role }: { role: string }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const items    = role === 'customer' ? portalNav : navItems
  const [open, setOpen] = useState(false)

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const NavLink = ({ href, label, icon }: { href: string; label: string; icon: string }) => (
    <Link href={href} onClick={() => setOpen(false)}
      className={clsx(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
        pathname.startsWith(href) && href !== '/dashboard'
          ? 'bg-white/15 text-white font-medium'
          : pathname === href
          ? 'bg-white/15 text-white font-medium'
          : 'text-white/60 hover:bg-white/10 hover:text-white'
      )}>
      <span className="text-base w-5 text-center">{icon}</span>
      {label}
    </Link>
  )

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-white/10">
        <Link href="/dashboard" onClick={() => setOpen(false)}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-white text-lg">⊙</div>
            <div>
              <div className="text-white font-semibold text-sm leading-tight">Eurotron IMS</div>
              <div className="text-white/40 text-xs">Gas Analyser Mgmt</div>
            </div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {items.map(item => <NavLink key={item.href} {...item} />)}

        {role === 'admin' && (
          <>
            <div className="pt-3 pb-1 px-3 text-white/30 text-xs uppercase tracking-wider">Admin</div>
            {adminItems.map(item => <NavLink key={item.href} {...item} />)}
          </>
        )}
      </nav>

      <div className="p-3 border-t border-white/10">
        <button onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:bg-white/10 hover:text-white transition-colors">
          <span className="text-base w-5 text-center">⏻</span> Sign out
        </button>
      </div>
    </div>
  )

  return (
    <>
      <aside className="hidden md:flex w-60 bg-brand-900 min-h-screen flex-col shrink-0">
        <SidebarContent />
      </aside>

      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-brand-900 flex items-center justify-between px-4 py-3 shadow-lg">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center text-white text-base">⊙</div>
          <span className="text-white font-semibold text-sm">Eurotron IMS</span>
        </Link>
        <button onClick={() => setOpen(!open)}
          className="text-white text-2xl w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors">
          {open ? 'X' : '='}
        </button>
      </div>

      {open && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="w-64 bg-brand-900 h-full shadow-2xl flex flex-col">
            <SidebarContent />
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setOpen(false)} />
        </div>
      )}

      <div className="md:hidden h-14 shrink-0" />
    </>
  )
}
