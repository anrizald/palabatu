import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import type { User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

export default function Header() {
    const [user, setUser] = useState<User | null>(null)

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)
        }

        getUser()

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user || null)
        })

        return () => {
            authListener.subscription.unsubscribe()
        }
    }, [])

    return (
        <nav className="h-16 fixed top-0 left-0 right-4 bg-transparent z-50 shadow px-4 flex items-center justify-between">
            {/* Left Links */}
            <div className="space-x-4">
                <Link to="/" className="text-lg underline">Home</Link>
                <Link to="/map" className="text-lg underline">Map</Link>
                <Link to="/about" className="text-lg underline">About</Link>
            </div>

            {/* Right Links */}
            <div className="space-x-4">
                <Link to="/auth" className="text-lg underline">Login</Link>
                <Link to="/auth" className="text-lg underline">Sign Up</Link>
            </div>
        </nav>
    )
}