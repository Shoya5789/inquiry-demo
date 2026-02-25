import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '行政AI問い合わせ対応',
  description: '住民からの問い合わせをAIで支援するプロトタイプ',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-slate-50">{children}</body>
    </html>
  )
}
