import { Plus, Minus, Crosshair } from 'lucide-react';
import { useState } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import { circleButtonStyle } from '../lib/constants.js';
import FallbackImg from './FallbackImg.js';

export function ZoomControlButtons() {
    const map = useMap();
    const [zoom, setZoom] = useState(map.getZoom());

    useMapEvents({
        zoomend() { setZoom(map.getZoom()); },
    });

    const zoomActions = [
        { key: 'in', onClick: () => map.zoomIn(), disabled: zoom >= map.getMaxZoom(), label: 'Zoom in', Icon: Plus },
        { key: 'out', onClick: () => map.zoomOut(), disabled: zoom <= map.getMinZoom(), label: 'Zoom out', Icon: Minus },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {zoomActions.map(({ key, onClick, disabled, label, Icon }) => (
                <button
                    key={key}
                    onClick={onClick}
                    disabled={disabled}
                    title={label}
                    aria-label={label}
                    style={{
                        ...circleButtonStyle,
                        width: '40px',
                        height: '40px',
                        cursor: disabled ? 'default' : 'pointer',
                        opacity: disabled ? 0.4 : 1,
                    }}
                >
                    <Icon size={18} color="#f0e0c8" />
                </button>
            ))}
        </div>
    );
}

export function RecenterButton({ position }: { position: [number, number] }) {
    const map = useMap();
    return (
        <button
            onClick={() => map.flyTo(position, map.getZoom())}
            title="Recenter map"
            aria-label="Recenter map"
            style={{
                ...circleButtonStyle,
                width: '48px',
                height: '48px',
                cursor: 'pointer',
            }}
        >
            <FallbackImg
                src="/assets/locate_me/crosshair-24.png"
                srcSet="/assets/locate_me/crosshair-24.png 1x, /assets/locate_me/crosshair-48.png 2x, /assets/locate_me/crosshair-72.png 3x"
                alt=""
                width={40}
                height={40}
                fallback={Crosshair}
            />
        </button>
    );
}
