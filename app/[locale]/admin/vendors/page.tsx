import { getVendors, getCurrentAdminPermissions } from "./actions"
import VendorsPageClient from "./VendorsPageClient"

export const dynamic = 'force-dynamic'
export default async function VendorsPage({ searchParams }: { searchParams?: Promise<{ filter?: string; status?: string }> | { filter?: string; status?: string } }) {
  const resolved = await Promise.resolve(searchParams || {})
  const initialFilter = resolved.filter || resolved.status || 'ALL'
  const [vendors, perms] = await Promise.all([
    getVendors(),
    getCurrentAdminPermissions(),
  ])
  return <VendorsPageClient initialVendors={vendors} initialFilter={initialFilter} canWrite={perms.canWrite} />
}
