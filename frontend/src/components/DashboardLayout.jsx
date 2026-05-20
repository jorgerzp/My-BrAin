import Sidebar from './Sidebar'

/**
 * Layout estándar: sidebar + área principal responsive.
 */
export default function DashboardLayout({ children, className = '' }) {
  const mainClass = ['dashboard-main', className].filter(Boolean).join(' ')
  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className={mainClass}>{children}</main>
    </div>
  )
}
