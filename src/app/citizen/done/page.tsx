'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function DoneContent() {
  const params = useSearchParams()
  const id = params.get('id')

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center space-y-6">
        <div className="text-6xl">✅</div>
        <h1 className="text-2xl font-bold text-gray-800">送信が完了しました</h1>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">受付番号</p>
          <p className="font-mono text-sm font-bold text-gray-800 break-all">{id}</p>
        </div>
        <div className="text-sm text-gray-600 space-y-2">
          <p>お問い合わせを受け付けました。</p>
          <p>返答をご希望の場合は、担当者よりご連絡いたします。</p>
        </div>
        <Link
          href="/citizen"
          className="block w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition"
        >
          新しい問い合わせをする
        </Link>
      </div>
    </div>
  )
}

export default function CitizenDonePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <DoneContent />
    </Suspense>
  )
}
