import { api } from '../lib/api.js'
import { useState, useEffect, useRef } from 'react'
import Header from '../components/Header.js'
import Toast, { type ToastProps } from '../components/Toast.js';

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

const LEVELS = ['Novice', 'Intermediate', 'Open', 'Andi/Anto'];
const ALL_STYLES: climbingStyle[] = ['Boulder', 'Lead', 'Toprope'];

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
    const [isSaving, setIsSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [user, setUser] = useState<any>(null)
    const [toast, setToast] = useState<ToastProps | null>(null);

    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/login';
            return;
        }
        api.get('/auth/session').then(data => {
            if (data.error) {
                window.location.href = '/login';
                return;
            }
            setUser(data.user);
        });
    }, []);

    useEffect(() => {
        if (!user) return;
        api.get(`/api/profiles/${user.id}`).then(data => {
            if (data) {
                console.log('title from DB:', data.title, typeof data.title);
                setProfile({
                    username: data.username || '',
                    title: Array.isArray(data.title)
                        ? data.title
                        : typeof data.title === 'string' ? [data.title] : [],
                    tags: {
                        level: data.tags?.level || '',
                        styles: data.tags?.styles || [],
                    },
                    avatar_url: data.avatar_url || '',
                })
            }
            setIsLoading(false);
        });
    }, [user]);

    const saveProfile = async () => {
        if (!user) return;
        setIsSaving(true);
        const data = await api.put(`/api/profiles/${user.id}`, {
            username: profile.username,
            title: profile.title,
            tags: profile.tags,
            avatar_url: profile.avatar_url,
        });
        setIsSaving(false);
        if (data.error) {
            setToast({ message: `Error updating profile: ${data.error}`, type: 'error', onClose: () => setToast(null) });
        } else {
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
            setToast({ message: 'Profile updated!', type: 'success', onClose: () => setToast(null) });
        }
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        setIsUploading(true);
        setToast({ message: 'Uploading avatar...', type: 'info', onClose: () => setToast(null) });

        try {
            const formData = new FormData();
            formData.append('avatar', file);

            // Upload the image to your backend
            const uploadRes = await api.upload('/api/upload/avatar/', formData);

            if (uploadRes.avatar_url) {
                // Update local state immediately so the user sees it
                setProfile(prev => ({ ...prev, avatar_url: uploadRes.avatar_url }));

                // Save it to the database so it persists
                await api.put(`/api/profiles/${user.id}`, {
                    ...profile,
                    avatar_url: uploadRes.avatar_url
                });

                setToast({ message: 'Avatar updated successfully!', type: 'success', onClose: () => setToast(null) });
            } else if (uploadRes.error) {
                setToast({ message: `Upload failed: ${uploadRes.error}`, type: 'error', onClose: () => setToast(null) });
            }
        } catch (error) {
            console.error('Failed to upload avatar', error);
            setToast({ message: 'Upload failed due to network error.', type: 'error', onClose: () => setToast(null) });
        } finally {
            setIsUploading(false);
            // Clear the input so the user can upload the same file again if needed
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    if (isLoading) return (
        <div style={{ minHeight: '100vh', background: '#0f0d0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: '#8a7060', fontFamily: 'Georgia, serif', letterSpacing: '0.1em' }}>Loading profile...</div>
        </div>
    );

    const initials = profile.username ? profile.username.slice(0, 2).toUpperCase() : '??';

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500&display=swap');
                * { box-sizing: border-box; margin: 0; padding: 0; }

                .profile-page {
                    min-height: 100vh;
                    background: #0f0d0b;
                    font-family: 'DM Sans', sans-serif;
                    padding: 80px 24px 40px;
                }

                .profile-wrap {
                    max-width: 760px;
                    margin: 0 auto;
                    display: grid;
                    grid-template-columns: 220px 1fr;
                    gap: 32px;
                    align-items: start;
                }

                @media (max-width: 640px) {
                    .profile-wrap { grid-template-columns: 1fr; }
                }

                .profile-sidebar {
                    background: #141210;
                    border: 1px solid #2a2420;
                    border-radius: 20px;
                    padding: 28px 20px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 16px;
                    position: sticky;
                    top: 80px;
                }

                .avatar-ring {
                    width: 100px; height: 100px;
                    border-radius: 50%;
                    background: linear-gradient(145deg, #c87a30, #7a3d10);
                    display: flex; align-items: center; justify-content: center;
                    font-family: 'Playfair Display', serif;
                    font-size: 32px;
                    font-weight: 900;
                    color: #f5e8d5;
                    box-shadow: 0 0 0 4px #1a1612, 0 0 0 6px #c87a3040;
                    cursor: pointer;
                    transition: box-shadow 0.2s;
                    overflow: hidden;
                }

                .avatar-ring:hover { box-shadow: 0 0 0 4px #1a1612, 0 0 0 6px #c87a3080; }
                .avatar-ring img { width: 100%; height: 100%; object-fit: cover; }

                .avatar-hint {
                    font-size: 11px;
                    color: #4a3c30;
                    text-align: center;
                    letter-spacing: 0.05em;
                }

                .sidebar-username {
                    font-family: 'Playfair Display', serif;
                    font-size: 18px;
                    font-weight: 700;
                    color: #f0e0c8;
                    text-align: center;
                }

                .sidebar-email {
                    font-size: 12px;
                    color: #6a5848;
                    text-align: center;
                    word-break: break-all;
                }

                .title-badge {
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-size: 11px;
                    font-weight: 500;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }

                .badge-council { background: rgba(200,122,48,0.15); color: #c87a30; border: 1px solid #c87a3040; }
                .badge-associate { background: rgba(93,187,106,0.1); color: #5dbb6a; border: 1px solid #5dbb6a40; }

                .profile-main {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .section-title {
                    font-family: 'Playfair Display', serif;
                    font-size: 22px;
                    font-weight: 900;
                    color: #f0e0c8;
                    margin-bottom: 4px;
                }

                .field-group {
                    background: #141210;
                    border: 1px solid #2a2420;
                    border-radius: 16px;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .field-label {
                    font-size: 11px;
                    color: #6a5848;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                    margin-bottom: 6px;
                }

                .field-input {
                    width: 100%;
                    background: #1a1612;
                    border: 1px solid #2a2420;
                    border-radius: 10px;
                    padding: 10px 14px;
                    color: #d8c8b8;
                    font-family: 'DM Sans', sans-serif;
                    font-size: 14px;
                    outline: none;
                    transition: border-color 0.2s;
                }

                .field-input:focus { border-color: #c87a30; }
                .field-input:read-only { color: #4a3c30; cursor: not-allowed; }

                .style-chips { display: flex; gap: 8px; flex-wrap: wrap; }

                .style-chip {
                    padding: 8px 16px;
                    border-radius: 20px;
                    border: 1px solid #2a2420;
                    background: transparent;
                    color: #6a5848;
                    font-family: 'DM Sans', sans-serif;
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .style-chip:hover { border-color: #c87a30; color: #c87a30; }
                .style-chip.active { background: rgba(200,122,48,0.12); border-color: #c87a30; color: #c87a30; }

                .level-options { display: flex; gap: 8px; flex-wrap: wrap; }

                .level-opt {
                    padding: 7px 14px;
                    border-radius: 10px;
                    border: 1px solid #2a2420;
                    background: transparent;
                    color: #6a5848;
                    font-family: 'DM Sans', sans-serif;
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .level-opt:hover { border-color: #c87a30; color: #c87a30; }
                .level-opt.active { background: rgba(200,122,48,0.12); border-color: #c87a30; color: #c87a30; }

                .title-options { display: flex; gap: 8px; }

                .title-opt {
                    flex: 1;
                    padding: 10px;
                    border-radius: 10px;
                    border: 1px solid #2a2420;
                    background: transparent;
                    color: #6a5848;
                    font-family: 'DM Sans', sans-serif;
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: center;
                }

                .title-opt:hover { border-color: #c87a30; }
                .title-opt.active-council { background: rgba(200,122,48,0.12); border-color: #c87a30; color: #c87a30; }
                .title-opt.active-associate { background: rgba(93,187,106,0.1); border-color: #5dbb6a; color: #5dbb6a; }

                .save-btn {
                    padding: 12px 28px;
                    background: linear-gradient(145deg, #c87a30, #8b4a18);
                    border: none;
                    border-radius: 12px;
                    color: #fef3e6;
                    font-family: 'DM Sans', sans-serif;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 2px 12px rgba(200,122,48,0.3);
                    align-self: flex-end;
                }

                .save-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(200,122,48,0.4); }
                .save-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
                .save-btn.saved { background: linear-gradient(145deg, #5dbb6a, #3a8a45); box-shadow: 0 2px 12px rgba(93,187,106,0.3); }
            `}</style>

            <Header />

            <div className="profile-page">
                {toast && <Toast {...toast} />}
                <div className="profile-wrap">
                    {/* Sidebar */}
                    <div className="profile-sidebar">
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            onChange={handleAvatarChange}
                            style={{ display: 'none' }}
                        />
                        <div
                            className="avatar-ring"
                            onClick={() => !isUploading && fileInputRef.current?.click()}
                            style={{ opacity: isUploading ? 0.5 : 1, cursor: isUploading ? 'wait' : 'pointer' }}
                        >
                            {profile.avatar_url
                                ? <img src={profile.avatar_url} alt="avatar" />
                                : initials
                            }
                        </div>
                        <div className="avatar-hint" style={{ color: isUploading ? '#c87a30' : '#4a3c30' }}>
                            {isUploading ? 'Uploading...' : 'click to change photo'}
                        </div>
                        <div className="sidebar-username">@{profile.username || 'climber'}</div>
                        <div className="sidebar-email">{user?.email}</div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                            {profile.title.map(t => (
                                <span key={t} className={`title-badge ${t === 'Council' ? 'badge-council' : 'badge-associate'}`}>{t}</span>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                            {profile.tags.styles.map(s => (
                                <span key={s} style={{ fontSize: '11px', color: '#8a7060', background: '#1a1612', padding: '3px 8px', borderRadius: '6px', border: '1px solid #2a2420' }}>{s}</span>
                            ))}
                        </div>
                    </div>

                    {/* Main */}
                    <div className="profile-main">
                        <div>
                            <div className="section-title">Your Profile</div>
                            <div style={{ fontSize: '13px', color: '#4a3c30', marginTop: '4px' }}>How the community sees you</div>
                        </div>

                        {/* Basic Info */}
                        <div className="field-group">
                            <div>
                                <div className="field-label">Email</div>
                                <input className="field-input" value={user?.email || ''} readOnly />
                            </div>
                            <div>
                                <div className="field-label">Username</div>
                                <input
                                    className="field-input"
                                    value={profile.username}
                                    onChange={e => setProfile({ ...profile, username: e.target.value })}
                                    placeholder="your username"
                                />
                            </div>
                        </div>

                        {/* Title */}
                        <div className="field-group">
                            <div>
                                <div className="field-label">Title</div>
                                <div className="title-options">
                                    {(['Council', 'Associate'] as Title[]).map(t => (
                                        <button
                                            key={t}
                                            className={`title-opt ${profile.title.includes(t) ? (t === 'Council' ? 'active-council' : 'active-associate') : ''}`}
                                            onClick={() => {
                                                const titles = profile.title.includes(t)
                                                    ? profile.title.filter(x => x !== t)
                                                    : [...profile.title, t];
                                                setProfile({ ...profile, title: titles });
                                            }}
                                        >{t}</button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Climbing Tags */}
                        <div className="field-group">
                            <div>
                                <div className="field-label">Level</div>
                                <div className="level-options">
                                    {LEVELS.map(l => (
                                        <button
                                            key={l}
                                            className={`level-opt ${profile.tags.level === l ? 'active' : ''}`}
                                            onClick={() => setProfile({ ...profile, tags: { ...profile.tags, level: l } })}
                                        >{l}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div className="field-label">Climbing Style</div>
                                <div className="style-chips">
                                    {ALL_STYLES.map(s => (
                                        <button
                                            key={s}
                                            className={`style-chip ${profile.tags.styles.includes(s) ? 'active' : ''}`}
                                            onClick={() => {
                                                const styles = profile.tags.styles.includes(s)
                                                    ? profile.tags.styles.filter(x => x !== s)
                                                    : [...profile.tags.styles, s];
                                                setProfile({ ...profile, tags: { ...profile.tags, styles } });
                                            }}
                                        >{s}</button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <button
                            className={`save-btn ${saved ? 'saved' : ''}`}
                            onClick={saveProfile}
                            disabled={isSaving}
                        >
                            {isSaving ? 'Saving...' : saved ? '✓ Saved' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}