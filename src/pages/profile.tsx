import { api } from '../lib/api.js'
import type { ChangeEvent } from 'react'
import { useState, useEffect } from 'react'
import Header from '../components/Header.js'
import { useAuth } from '../lib/AuthContext.js';

type climbingStyle = "Boulder" | "Lead" | "Toprope";
type Title = "Council" | "Associate"

type Profile = {
    username: string;
    title: Title[]; // multiple selections allowed
    tags: {
        level: string; // could also be a union like "Beginner" | "Intermediate" | "Advanced"
        styles: climbingStyle[];
    };
    avatar_url: string;
};

export default function Profile() {
    const [profile, setProfile] = useState<Profile>({
        username: "",
        title: [],
        tags: {
            level: "",
            styles: [],
        },
        avatar_url: '',
    })
    const [isLoading, setIsLoading] = useState(true)
    const [user, setUser] = useState<any>(null)

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/login';
            return;
        }

        const loadSession = async () => {
            const data = await api.get('/auth/session');
            if (data.error) {
                window.location.href = '/login';
                return;
            }
            setUser(data.user);
        };

        loadSession();
    }, []);

    // Load profile from whenever session changes
    useEffect(() => {
        if (!user) return;

        const loadProfile = async () => {
            const data = await api.get(`/api/profiles/${user.id}`);
            if (data) {
                setProfile({
                    username: data.username || '',
                    title: data.title || [],
                    tags: {
                        level: data.tags?.level || '',
                        styles: data.tags?.styles || [],
                    },
                    avatar_url: data.avatar_url || '',
                })
                setIsLoading(false);
            }
        };

        loadProfile();
    }, [user]);

    const saveProfile = async () => {
        if (!user) return;
        const data = await api.put(`/api/profiles/${user.id}`, {
            username: profile.username,
            title: profile.title,
            tags: profile.tags,
            avatar_url: profile.avatar_url,
        });
        if (data.error) alert(`Error Updating profile: ${data.error}`);
        else alert('Profile updated successfully!');
    };

    if (isLoading) return <div>Loading Profile...</div>

    const handleTitleChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const selectedTitles = Array.from(e.target.selectedOptions).map(
            (option) => option.value as Title
        )
        setProfile({ ...profile, title: selectedTitles })
    }

    const ALL_STYLES: climbingStyle[] = ['Boulder', 'Lead', 'Toprope']

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

            {/* Email (read-only) */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Registered Email</label>
                <input
                    type="email"
                    className="w-full border px-3 py-2 rounded bg-gray-100 text-gray-600"
                    value={user?.email || ""}
                    readOnly
                />
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
                    multiple
                    value={profile.title}
                    onChange={handleTitleChange}
                    className="w-full border px-3 py-2 rounded"
                >
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
                    {ALL_STYLES.map((style) => (
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