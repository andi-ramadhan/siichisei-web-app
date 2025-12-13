import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { MessageSquare, GraduationCap, Settings, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function DashboardLayout() {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card hidden md:flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Siichisei
          </h1>
        </div>

        <nav className="flex-1 px-4 space-y-6">
          <div className="space-y-2">
            <h3 className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Learning
            </h3>
            <NavItem to="/chat" icon={MessageSquare}>
              Chat
            </NavItem>
            <NavItem to="/classroom" icon={GraduationCap}>
              Classroom
            </NavItem>
          </div>

          <div className="h-px bg-border/50 mx-2" />

          <div className="space-y-2">
            <h3 className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              System
            </h3>
            <NavItem to="/settings" icon={Settings}>
              Settings
            </NavItem>
          </div>
        </nav>

        <div className="p-4 border-t">
          {/* User info can go here later */}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

function NavItem({ to, icon: Icon, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:text-primary",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted"
        )
      }
    >
      <Icon className="h-4 w-4" />
      {children}
    </NavLink>
  )
}
