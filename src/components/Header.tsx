import { Link } from 'react-router-dom';
import { useAuth } from '../lib/useAuth.js';
import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import type { User } from '@supabase/supabase-js';

export default function Header() {
    const { user, handleLogout } = useAuth();

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
                {!user ? (
                    <>
                        <Link to="/login" className="text-lg underline">Login</Link>
                        <Link to="/signup" className="text-lg underline">Sign Up</Link>
                    </>
                ) : (
                    <>
                        <Link to="/profile" className="text-lg underline">Profile</Link>
                        <button onClick={handleLogout} className="text-lg underline text-red-500">
                            Logout
                        </button>
                    </>
                )}
            </div>
        </nav>
    );
}