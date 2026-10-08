import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import TermsConsentGuard from '@/components/legal/TermsConsentGuard'

export const metadata: Metadata = {
  title: 'QRコード打刻システム',
  description: 'QRコードを用いたイベント参加者の打刻管理システム',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          <TermsConsentGuard>{children}</TermsConsentGuard>
        </AuthProvider>
      </body>
    </html>
  )
}
