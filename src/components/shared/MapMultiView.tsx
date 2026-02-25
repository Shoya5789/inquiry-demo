'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import Link from 'next/link'

interface Pin {
  id: string
  lat: number
  lng: number
  aiSummary: string
  urgency: string
  status: string
  addressText: string
}

const URGENCY_COLORS: Record<string, string> = {
  HIGH: '#ef4444',
  MED: '#f59e0b',
  LOW: '#22c55e',
}

function makeIcon(urgency: string) {
  const color = URGENCY_COLORS[urgency] || '#6b7280'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 24 12 24s12-15.6 12-24C24 5.4 18.6 0 12 0z" fill="${color}"/>
    <circle cx="12" cy="12" r="5" fill="white"/>
  </svg>`
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
  })
}

interface MapMultiViewProps {
  pins: Pin[]
}

export default function MapMultiView({ pins }: MapMultiViewProps) {
  useEffect(() => {
    delete (L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: unknown })._getIconUrl
  }, [])

  const center: [number, number] = pins.length > 0 ? [pins[0].lat, pins[0].lng] : [35.6762, 139.6503]

  return (
    <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {pins.map((pin) => (
        <Marker key={pin.id} position={[pin.lat, pin.lng]} icon={makeIcon(pin.urgency)}>
          <Popup>
            <div className="min-w-[200px]">
              <p className="font-semibold text-sm">{pin.aiSummary}</p>
              {pin.addressText && <p className="text-xs text-gray-500">{pin.addressText}</p>}
              <p className="text-xs text-gray-400 mt-1">緊急度: {pin.urgency} | {pin.status}</p>
              <a href={`/staff/inquiries/${pin.id}`} className="text-blue-600 text-xs hover:underline">詳細を見る →</a>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
