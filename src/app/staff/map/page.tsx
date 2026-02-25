'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const MapMultiView = dynamic(() => import('@/components/shared/MapMultiView'), { ssr: false })

interface InquiryPin {
  id: string
  lat: number
  lng: number
  aiSummary: string
  urgency: string
  status: string
  addressText: string
}

export default function StaffMapPage() {
  const [pins, setPins] = useState<InquiryPin[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/staff/inquiries')
      .then((r) => r.json())
      .then((data) => {
        const withLocation = (data.inquiries || []).filter((inq: InquiryPin) => inq.lat && inq.lng)
        setPins(withLocation)
        setLoading(false)
      })
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-slate-800 text-white px-4 py-3 flex items-center gap-4">
        <Link href="/staff" className="text-gray-300 hover:text-white text-sm">← 一覧</Link>
        <h1 className="text-lg font-bold">🗺️ 地図ビュー</h1>
        <span className="text-gray-300 text-sm">{pins.length}件の問い合わせ</span>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">読み込み中...</div>
      ) : (
        <div className="flex-1" style={{ height: 'calc(100vh - 56px)' }}>
          <MapMultiView pins={pins} />
        </div>
      )}
    </div>
  )
}
