import { getBookedCallsAction } from "@/app/actions/booked-calls"
import BookedCallsPageClient from "./BookedCallsPageClient"

export const dynamic = 'force-dynamic'

export default async function BookedCallsPage() {
  const result = await getBookedCallsAction()
  const bookedCalls = result.success && result.bookedCalls ? result.bookedCalls : []
  
  return <BookedCallsPageClient initialBookedCalls={bookedCalls} />
}
