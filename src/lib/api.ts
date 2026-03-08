/// <reference types="vite/client" />
const BASE = import.meta.env.VITE_API_URL;

export const api = {
    post: (path: string, body: unknown) => fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(body)
    }).then(r => r.json()),

    get: (path: string) => fetch(`${BASE}${path}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    }).then(r => r.json()),

    put: (path: string, body: unknown) => fetch(`${BASE}${path}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(body)
    }).then(r => r.json()),
};