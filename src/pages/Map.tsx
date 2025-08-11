import 'leaflet/dist/leaflet.css'
import Header from '../components/Header.js'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'

export default function MapPage() {
    const center: [number, number] = [-7.797068, 110.370529]
    return (
        <div className="h-[calc(100vh-64px)] w-full pt-16 -z-1">
            <Header />
            <MapContainer {...({ center, zoom: 5 } as any)} className="h-full w-full">
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[51.505, -0.09]}>
                    <Popup>
                        Contoh Boulder
                    </Popup>
                </Marker>
            </MapContainer>
        </div>
    )
}