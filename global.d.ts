declare module '*.css';

// Minimal Leaflet type shims to satisfy react-leaflet without @types/leaflet
declare module 'leaflet' {
    export type LatLngExpression = [number, number] | [number, number, number] | { lat: number; lng: number };
    export interface MapOptions {
        center?: LatLngExpression;
        zoom?: number;
    }
}