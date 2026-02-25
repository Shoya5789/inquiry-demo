'use client'

import { useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'

const icon = L.icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
})

interface MapPickerProps {
  lat: number | null
  lng: number | null
  onChange: (lat: number, lng: number) => void
}

function ClickHandler({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export default function MapPicker({ lat, lng, onChange }: MapPickerProps) {
  useEffect(() => {
    delete (L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: unknown })._getIconUrl
    L.Icon.Default.mergeOptions({
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    })
  }, [])

  const handleChange = useCallback(onChange, [onChange])

  // Default: Tokyo center
  const center: [number, number] = lat && lng ? [lat, lng] : [35.6762, 139.6503]

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'rgba(255,255,255,0.9)', padding: '4px 8px', borderRadius: 4, fontSize: 12, pointerEvents: 'none' }}>
        地図をクリックして位置を設定
      </div>
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onChange={handleChange} />
        {lat && lng && <Marker position={[lat, lng]} icon={icon} />}
      </MapContainer>
    </div>
  )
}
