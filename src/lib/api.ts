/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const getUrl = (path: string) => {
    const cleanBase = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${cleanBase}${cleanPath}`;
}

export const api = {
    post: (path: string, body: unknown) => fetch(getUrl(path), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(body)
    }).then(r => r.json()),

    get: (path: string) => fetch(getUrl(path), {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    }).then(r => r.json()),

    put: (path: string, body: unknown) => fetch(getUrl(path), {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(body)
    }).then(r => r.json()),

    upload: (path: string, formData: FormData) => fetch(getUrl(path), {
        method: 'POST',
        headers: {
            // Notice: No 'Content-Type' header here. The browser sets it automatically for FormData!
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
    }).then(r => r.json()),
};