import { redirect } from 'next/navigation'

// @deprecated — /employees/me is consolidated into /my/profile (Session 90)
export default function MyProfilePage() {
  redirect('/my/profile')
}
