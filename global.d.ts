declare module '*.css';
declare module '../lib/supabase.ts' {
    import { SupabaseClient } from '@supabase/supabase-js';
    export const supabase: SupabaseClient;
}

// Minimal Leaflet type shims to satisfy react-leaflet without @types/leaflet
declare module 'leaflet' {
    export type LatLngExpression = [number, number] | [number, number, number] | { lat: number; lng: number };
    export interface MapOptions {
        center?: LatLngExpression;
        zoom?: number;
    }
}