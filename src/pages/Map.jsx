import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import Header from '../components/Header';

export default function MapPage() {
    return (
        <div className="h-[calc(100vh-64px)] w-full pt-16 -z-1">
            <Header />
            <MapContainer center={[-7.797068, 110.370529]} zoom={5} className="h-full w-full">
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[51.505, -0.09]}>
                    <Popup>
                        Contoh Boulder
                    </Popup>
                </Marker>
            </MapContainer>
        </div>
    )
}