import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import { useState, useEffect } from 'react'

export default function Profile() {
    const [profile, setProfile] = useState({
        username: '',
        title: '',
        tags: {
            level: '',
            styles: [], // e.g. [Boulder / Lead]
        },
        avatar_url: '',
    })
    const [loading, setLoading] = useState(true)

    // Load profile from Supabase
    useEffect(() => {
        const loadProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                window.location.href = '/auth' // Redirect to auth page if not logged in
                return
            }

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single()

            if (data) {
                setProfile({
                    username: data.username || '',
                    title: data.title || '',
                    tags: data.tags || { level: '', styles: [] },
                    avatar_url: data.avatar_url || '',
                })
            }
            setLoading(false)
        }

        loadProfile()
    }, [])

    const saveProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser();

        const updates = {
            id: user.id,
            username: profile.username,
            title: profile.title,
            tags: profile.tags,
            avatar_url: profile.avatar_url,
            // update_at: new Date().toISOString(),
        }

        const { error } = await supabase
            .from('profiles')
            .update(updates)
        if (error) {
            alert('Error saving profile:', error.message)
        } else {
            alert('Profile saved successfully')
        }
    }

    if (loading) return <div>Loading Profile...</div>

    return (
        <div className="max-w-2xl mx-auto h-screen justify-center flex flex-col">
            <Header />
            <h1 className="text-3xl font-bold mb-6">Profile</h1>

            {/* Profile Picture */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Profile Picture</label>
                {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="Profile" className="w-24 h-24 rounded-full object-cover mb-2" />
                ) : (
                    <div className="w-24 h-24 bg-gray-300 rounded-full mb-2"></div>
                )}
                {/* We'll handle upload later */}
                <input type="file" accept="image/*" />
            </div>

            {/* Username */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                    type="text"
                    className="w-full border px-3 py-2 rounded"
                    value={profile.username}
                    onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                />
            </div>

            {/* Title */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <select
                    value={profile.title}
                    onChange={(e) => setProfile({ ...profile, title: e.target.value })}
                    className="w-full border px-3 py-2 rounded"
                >
                    <option value="">Select title</option>
                    <option value="Council">Council</option>
                    <option value="Associate">Associate</option>
                </select>
            </div>

            {/* Tags: Level */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
                <input
                    type="text"
                    className="w-full border px-3 py-2 rounded"
                    value={profile.tags.level}
                    onChange={(e) =>
                        setProfile({
                            ...profile,
                            tags: { ...profile.tags, level: e.target.value },
                        })
                    }
                />
            </div>

            {/* Tags: Styles */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Styles</label>
                <div className="flex gap-2">
                    {['Boulder', 'Lead', 'Toprope'].map((style) => (
                        <label key={style} className="flex items-center gap-1">
                            <input
                                type="checkbox"
                                checked={profile.tags.styles.includes(style)}
                                onChange={(e) => {
                                    const styles = e.target.checked
                                        ? [...profile.tags.styles, style]
                                        : profile.tags.styles.filter((s) => s !== style)
                                    setProfile({
                                        ...profile,
                                        tags: { ...profile.tags, styles },
                                    })
                                }}
                            />
                            {style}
                        </label>
                    ))}
                </div>
            </div>

            <button
                onClick={saveProfile}
                className="mt-4 px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
                Save Changes
            </button>
        </div>
    )
}