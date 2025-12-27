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
      {/* Main Content */}
      <main className="flex-1 overflow-auto md:mb-0 mb-16">
        <Outlet />
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-zinc-950 border-t border-gray-200 dark:border-zinc-800 flex justify-around items-center z-50">
        <NavLink to="/chat" className={({ isActive }) => cn("flex flex-col items-center gap-1 p-2 text-xs font-medium transition-colors", isActive ? "text-indigo-600" : "text-gray-500 hover:text-gray-900")}>
          <MessageSquare className="h-6 w-6" />
          <span>Chat</span>
        </NavLink>
        <NavLink to="/classroom" className={({ isActive }) => cn("flex flex-col items-center gap-1 p-2 text-xs font-medium transition-colors", isActive ? "text-indigo-600" : "text-gray-500 hover:text-gray-900")}>
          <GraduationCap className="h-6 w-6" />
          <span>Classroom</span>
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => cn("flex flex-col items-center gap-1 p-2 text-xs font-medium transition-colors", isActive ? "text-indigo-600" : "text-gray-500 hover:text-gray-900")}>
          <Settings className="h-6 w-6" />
          <span>Settings</span>
        </NavLink>
      </nav>
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
