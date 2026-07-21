import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Check, Calendar, MapPin, Eye, EyeOff, Trash2, ChevronDown } from 'lucide-react'
import { api } from '../lib/api.js'
import { useAuth } from '../lib/useAuth.js'
import Toast from '../components/Toast.js'

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
    bio: string;
    location: string;
    created_at: string;
};

type ProfileStats = {
    sends_count: number;
    problems_count: number;
};

type ReactionType = 'like' | 'fire' | 'heart';
type ReactionCounts = Record<ReactionType, number>;
type ReactionStatus = Record<ReactionType, boolean>;

type RecentSend = {
    problem_id: string;
    problem_name: string;
    grade: string | null;
    created_at: string;
};

type RecentProblem = {
    id: string;
    name: string;
    grade: string | null;
    created_at: string;
};

type RecentActivity = {
    sends: RecentSend[];
    problems: RecentProblem[];
};

const LEVELS = ['Novice', 'Intermediate', 'Open', 'Andi/Anto'];
const ALL_STYLES: climbingStyle[] = ['Boulder', 'Lead', 'Toprope'];
const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
    { type: 'like', emoji: '👍', label: 'Like' },
    { type: 'fire', emoji: '🔥', label: 'Fire' },
    { type: 'heart', emoji: '❤️', label: 'Heart' },
];

const formatJoinDate = (iso: string) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime()) || d.getFullYear() < 1971) return null;
    return `Joined ${d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
};

const formatRelativeDate = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
};

export default function Profile() {
    const { slug } = useParams<{ slug: string }>();
    const { user, handleLogout, toast, showToast } = useAuth();

    const [profile, setProfile] = useState<Profile>({
        username: "",
        title: [],
        tags: {
            level: "",
            styles: [],
        },
        avatar_url: '',
        bio: '',
        location: '',
        created_at: '',
    })
    const [loadError, setLoadError] = useState<string | null>(null)
    const [stats, setStats] = useState<ProfileStats | null>(null)
    const [activity, setActivity] = useState<RecentActivity>({ sends: [], problems: [] })
    const [reactionCounts, setReactionCounts] = useState<ReactionCounts>({ like: 0, fire: 0, heart: 0 })
    const [reactionStatus, setReactionStatus] = useState<ReactionStatus>({ like: false, fire: false, heart: false })
    const [reactingType, setReactingType] = useState<ReactionType | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [showPassword, setShowPassword] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    const [showAdvanced, setShowAdvanced] = useState(false);

    const isOwner = !!(user && user.slug === slug);
    const isSelfAdmin = isOwner && (profile.title.includes('Council') || profile.title.includes('Associate'));

    useEffect(() => {
        if (!slug) return;
        setIsLoading(true);
        setLoadError(null);

        api.get(`/api/profiles/${slug}`).then(data => {
            if (data && !data.error) {
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
                    bio: data.bio || '',
                    location: data.location || '',
                    created_at: data.created_at || '',
                })
            } else {
                setLoadError(data?.error || 'Failed to load this profile.');
            }
            setIsLoading(false);
        });

        api.get(`/api/profiles/${slug}/stats`).then(data => {
            if (data && !data.error) setStats(data);
        });

        api.get(`/api/profiles/${slug}/activity`).then(data => {
            if (data && !data.error) setActivity(data);
        });

        api.get(`/api/profiles/${slug}/reactions`).then(data => {
            if (data && !data.error) setReactionCounts(data);
        });
    }, [slug]);

    useEffect(() => {
        if (!slug || !user) return;

        api.get(`/api/profiles/${slug}/reactions/status`).then(data => {
            if (data && !data.error) setReactionStatus(data);
        });
    }, [slug, user]);

    const handleToggleReaction = async (type: ReactionType) => {
        if (!user) {
            showToast('Log in to react to this profile.', 'error');
            return;
        }
        setReactingType(type);

        try {
            const res = await api.post(`/api/profiles/${slug}/reactions/${type}`, {});
            if (res.error) {
                showToast(res.error, 'error');
            } else {
                const added = res.action === 'added';
                setReactionStatus(prev => ({ ...prev, [type]: added }));
                setReactionCounts(prev => ({ ...prev, [type]: prev[type] + (added ? 1 : -1) }));
            }
        } catch (e) {
            console.error('Reaction toggle failed', e);
            showToast('Failed to react. Check your connection.', 'error');
        } finally {
            setReactingType(null);
        }
    };

    const saveProfile = async () => {
        if (!isOwner || !user) return;
        setIsSaving(true);
        const data = await api.put(`/api/profiles/${user.id}`, {
            username: profile.username,
            title: profile.title,
            tags: profile.tags,
            avatar_url: profile.avatar_url,
            bio: profile.bio,
            location: profile.location,
        });
        setIsSaving(false);
        if (data.error) {
            showToast(`Error updating profile: ${data.error}`, 'error');
        } else {
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
            showToast('Profile updated!');
        }
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isOwner || !user) return;
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        showToast('Uploading avatar...');

        try {
            const formData = new FormData();
            formData.append('avatar', file);

            const uploadRes = await api.upload('/api/upload/avatar/', formData);

            if (uploadRes.avatar_url) {
                setProfile(prev => ({ ...prev, avatar_url: uploadRes.avatar_url }));
                await api.put(`/api/profiles/${user.id}`, {
                    ...profile,
                    avatar_url: uploadRes.avatar_url
                });

                showToast('Avatar updated successfully!');
            } else if (uploadRes.error) {
                showToast(`Upload failed: ${uploadRes.error}`, 'error');
            }
        } catch (error) {
            console.error('Avatar upload failed', error);
            showToast('Upload failed due to network error.', 'error');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleChangePassword = async () => {
        if (!isOwner) return;
        setIsChangingPassword(true);
        const data = await api.put('/auth/password', {
            current_password: currentPassword,
            new_password: newPassword,
        });
        setIsChangingPassword(false);
        if (data.error) {
            showToast(data.error, 'error');
        } else {
            showToast('Password changed successfully');
            setCurrentPassword('');
            setNewPassword('');
        }
    };

    const handleDeleteAccount = async () => {
        if (!isOwner) return;
        setIsDeleting(true);
        const data = await api.delete('/auth/account', { password: deletePassword });
        setIsDeleting(false);
        if (data.error) {
            showToast(data.error, 'error');
        } else {
            handleLogout();
        }
    };

    if (isLoading) return (
        <div className="min-h-screen bg-ink flex items-center justify-center">
            <div className="text-text-muted font-serif tracking-wider">Loading profile...</div>
        </div>
    );

    if (loadError) return (
        <div className="min-h-screen bg-ink flex flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="font-serif text-2xl font-black text-text">Profile not found</div>
            <div className="text-sm text-text-dim">{loadError}</div>
            <Link to="/map" className="mt-2 text-sm text-accent hover:underline">Back to the map</Link>
        </div>
    );

    const initials = profile.username ? profile.username.slice(0, 2).toUpperCase() : '??';
    const joinDate = formatJoinDate(profile.created_at);

    return (
        <>
            {toast && <Toast {...toast} />}

            <div className="min-h-screen bg-ink font-sans px-6 pt-20 pb-10">
                <div className="max-w-[760px] mx-auto grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-8 items-start">
                    {/* Sidebar */}
                    <div className="bg-panel border border-border rounded-[20px] px-5 py-7 flex flex-col items-center gap-4 sm:sticky sm:top-20">
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            onChange={handleAvatarChange}
                            className="hidden"
                        />
                        <div
                            onClick={() => isOwner && !isUploading && fileInputRef.current?.click()}
                            className={`w-[100px] h-[100px] rounded-full bg-gradient-to-br from-accent to-[#7a3d10] flex items-center justify-center font-serif text-[32px] font-black text-[#f5e8d5] overflow-hidden transition-shadow
                                ${isOwner ? 'shadow-[0_0_0_4px_#1a1612,0_0_0_6px_rgba(200,122,48,0.25)] hover:shadow-[0_0_0_4px_#1a1612,0_0_0_6px_rgba(200,122,48,0.5)] cursor-pointer' : 'shadow-[0_0_0_4px_#1a1612,0_0_0_6px_#2a2420]'}
                                ${isUploading ? 'opacity-50 cursor-wait' : ''}`}
                        >
                            {profile.avatar_url
                                ? <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                                : initials
                            }
                        </div>

                        {isOwner && (
                            <div className={`text-[11px] text-center tracking-wide ${isUploading ? 'text-accent' : 'text-text-faint'}`}>
                                {isUploading ? 'Uploading...' : 'click to change photo'}
                            </div>
                        )}

                        <div className="font-serif text-lg font-bold text-text text-center">{profile.username || 'climber'}</div>

                        {isOwner && <div className="text-xs text-text-dim text-center break-all">{user?.email}</div>}

                        {(joinDate || profile.location) && (
                            <div className="flex flex-col items-center gap-1">
                                {joinDate && (
                                    <div className="flex items-center gap-1.5 text-xs text-text-dim">
                                        <Calendar size={12} className="shrink-0" /> {joinDate}
                                    </div>
                                )}
                                {profile.location && (
                                    <div className="flex items-center gap-1.5 text-xs text-text-dim">
                                        <MapPin size={12} className="shrink-0" /> {profile.location}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex gap-1.5 flex-wrap justify-center">
                            {profile.title.map(t => (
                                <span
                                    key={t}
                                    className={`px-3 py-1 rounded-full text-[11px] font-medium tracking-wide uppercase border ${t === 'Council' ? 'bg-accent/15 text-accent border-accent/25' : 'bg-associate/10 text-associate border-associate/25'}`}
                                >{t}</span>
                            ))}
                        </div>
                        <div className="flex gap-1.5 flex-wrap justify-center">
                            {profile.tags.styles.map(s => (
                                <span key={s} className="text-[11px] text-text-muted bg-surface px-2 py-1 rounded-md border border-border">{s}</span>
                            ))}
                        </div>

                        {profile.bio && (
                            <p className="text-xs text-text-secondary text-center leading-relaxed">{profile.bio}</p>
                        )}

                        {stats && (
                            <div className="flex gap-5 pt-1">
                                <div className="text-center">
                                    <div className="font-serif text-xl font-bold text-text">{stats.sends_count}</div>
                                    <div className="text-[10px] text-text-dim tracking-wide uppercase">Sends</div>
                                </div>
                                <div className="text-center">
                                    <div className="font-serif text-xl font-bold text-text">{stats.problems_count}</div>
                                    <div className="text-[10px] text-text-dim tracking-wide uppercase">Added</div>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2 pt-1">
                            {REACTIONS.map(({ type, emoji, label }) => (
                                <button
                                    key={type}
                                    onClick={() => !isOwner && handleToggleReaction(type)}
                                    disabled={isOwner || reactingType === type}
                                    title={isOwner ? `${label} reactions from other climbers` : `${label} this profile`}
                                    className={`flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-xl border transition-colors
                                        ${reactionStatus[type] ? 'bg-accent/15 border-accent' : 'bg-transparent border-border'}
                                        ${isOwner ? 'cursor-default' : 'cursor-pointer'}
                                        ${reactingType === type ? 'opacity-60' : ''}`}
                                >
                                    <span className="text-lg">{emoji}</span>
                                    <span className={`text-[11px] font-bold ${reactionStatus[type] ? 'text-accent' : 'text-text-dim'}`}>{reactionCounts[type]}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Main */}
                    <div className="flex flex-col gap-4">
                        <div>
                            <div className="font-serif text-[22px] font-black text-text">
                                {isOwner ? 'Your Profile' : `${profile.username || 'Climber'}'s Activity`}
                            </div>
                            <div className="text-[13px] text-text-faint mt-1">
                                {isOwner ? 'How the community sees you' : 'Recent sends and additions'}
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="bg-panel border border-border rounded-2xl p-5 flex flex-col gap-5">
                            <div>
                                <div className="text-[11px] text-text-dim tracking-wide uppercase mb-2">Recent Sends</div>
                                {activity.sends.length === 0 ? (
                                    <p className="text-sm text-text-faint">No sends yet.</p>
                                ) : (
                                    <ul className="flex flex-col gap-2">
                                        {activity.sends.map(s => (
                                            <li key={s.problem_id} className="flex items-center justify-between gap-3 text-sm">
                                                <span className="text-text-secondary truncate">{s.problem_name}</span>
                                                <span className="flex items-center gap-2 shrink-0 text-text-dim">
                                                    {s.grade && <span className="text-xs text-accent">{s.grade}</span>}
                                                    <span className="text-xs">{formatRelativeDate(s.created_at)}</span>
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <div>
                                <div className="text-[11px] text-text-dim tracking-wide uppercase mb-2">Recently Added</div>
                                {activity.problems.length === 0 ? (
                                    <p className="text-sm text-text-faint">No problems added yet.</p>
                                ) : (
                                    <ul className="flex flex-col gap-2">
                                        {activity.problems.map(p => (
                                            <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                                                <span className="text-text-secondary truncate">{p.name}</span>
                                                <span className="flex items-center gap-2 shrink-0 text-text-dim">
                                                    {p.grade && <span className="text-xs text-accent">{p.grade}</span>}
                                                    <span className="text-xs">{formatRelativeDate(p.created_at)}</span>
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>

                        {isOwner && (<>

                        {/* Basic Info */}
                        <div className="bg-panel border border-border rounded-2xl p-5 flex flex-col gap-4">
                            {isOwner && (
                                <div>
                                    <div className="text-[11px] text-text-dim tracking-wide uppercase mb-1.5">Email</div>
                                    <input className="w-full bg-surface border border-border rounded-[10px] px-3.5 py-2.5 text-text-faint text-sm cursor-not-allowed outline-none" value={user?.email || ''} readOnly />
                                </div>
                            )}
                            <div>
                                <div className="text-[11px] text-text-dim tracking-wide uppercase mb-1.5">Username</div>
                                <input
                                    className={`w-full bg-surface border border-border focus:border-accent rounded-[10px] px-3.5 py-2.5 text-text-secondary text-sm outline-none transition-colors ${isOwner ? 'cursor-text' : 'cursor-default text-text-faint'}`}
                                    value={profile.username}
                                    onChange={e => isOwner && setProfile({ ...profile, username: e.target.value })}
                                    placeholder="your username"
                                    readOnly={!isOwner}
                                />
                            </div>
                        </div>

                        {/* About */}
                        <div className="bg-panel border border-border rounded-2xl p-5 flex flex-col gap-4">
                            <div>
                                <div className="text-[11px] text-text-dim tracking-wide uppercase mb-1.5">Bio</div>
                                {isOwner ? (
                                    <textarea
                                        className="w-full bg-surface border border-border focus:border-accent rounded-[10px] px-3.5 py-2.5 text-text-secondary text-sm outline-none transition-colors resize-none"
                                        rows={3}
                                        maxLength={300}
                                        value={profile.bio}
                                        onChange={e => setProfile({ ...profile, bio: e.target.value })}
                                        placeholder="A short line about you and your climbing"
                                    />
                                ) : (
                                    <p className="text-sm text-text-secondary">{profile.bio || 'No bio yet.'}</p>
                                )}
                            </div>
                            <div>
                                <div className="text-[11px] text-text-dim tracking-wide uppercase mb-1.5">Location</div>
                                <input
                                    className={`w-full bg-surface border border-border focus:border-accent rounded-[10px] px-3.5 py-2.5 text-text-secondary text-sm outline-none transition-colors ${isOwner ? 'cursor-text' : 'cursor-default text-text-faint'}`}
                                    value={profile.location}
                                    onChange={e => isOwner && setProfile({ ...profile, location: e.target.value })}
                                    placeholder="City, region"
                                    maxLength={100}
                                    readOnly={!isOwner}
                                />
                            </div>
                        </div>

                        {/* Title */}
                        <div className="bg-panel border border-border rounded-2xl p-5 flex flex-col gap-4">
                            <div>
                                <div className="text-[11px] text-text-dim tracking-wide uppercase mb-1.5">Title</div>
                                <div className="flex gap-2">
                                    {(['Council', 'Associate'] as Title[]).map(t => {
                                        const active = profile.title.includes(t);
                                        return (
                                            <button
                                                key={t}
                                                onClick={() => {
                                                    if (!isSelfAdmin) return;
                                                    const titles = active
                                                        ? profile.title.filter(x => x !== t)
                                                        : [...profile.title, t];
                                                    setProfile({ ...profile, title: titles });
                                                }}
                                                className={`flex-1 py-2.5 rounded-[10px] border text-sm text-center transition-colors
                                                    ${active && t === 'Council' ? 'bg-accent/15 border-accent text-accent' : ''}
                                                    ${active && t === 'Associate' ? 'bg-associate/10 border-associate text-associate' : ''}
                                                    ${!active ? 'bg-transparent border-border text-text-dim' : ''}
                                                    ${isSelfAdmin ? 'cursor-pointer hover:border-accent' : 'cursor-default'}
                                                    ${!isSelfAdmin && !active ? 'opacity-30' : ''}`}
                                            >{t}</button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Climbing Tags */}
                        <div className="bg-panel border border-border rounded-2xl p-5 flex flex-col gap-4">
                            <div>
                                <div className="text-[11px] text-text-dim tracking-wide uppercase mb-1.5">Level</div>
                                <div className="flex gap-2 flex-wrap">
                                    {LEVELS.map(l => (
                                        <button
                                            key={l}
                                            onClick={() => isOwner && setProfile({ ...profile, tags: { ...profile.tags, level: l } })}
                                            className={`px-3.5 py-1.5 rounded-[10px] border text-sm transition-colors
                                                ${profile.tags.level === l ? 'bg-accent/15 border-accent text-accent' : 'bg-transparent border-border text-text-dim'}
                                                ${isOwner ? 'cursor-pointer hover:border-accent hover:text-accent' : 'cursor-default'}
                                                ${!isOwner && profile.tags.level !== l ? 'opacity-30' : ''}`}
                                        >{l}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div className="text-[11px] text-text-dim tracking-wide uppercase mb-1.5">Climbing Style</div>
                                <div className="flex gap-2 flex-wrap">
                                    {ALL_STYLES.map(s => {
                                        const active = profile.tags.styles.includes(s);
                                        return (
                                            <button
                                                key={s}
                                                onClick={() => {
                                                    if (!isOwner) return;
                                                    const styles = active
                                                        ? profile.tags.styles.filter(x => x !== s)
                                                        : [...profile.tags.styles, s];
                                                    setProfile({ ...profile, tags: { ...profile.tags, styles } });
                                                }}
                                                className={`px-4 py-2 rounded-full border text-sm transition-colors
                                                    ${active ? 'bg-accent/15 border-accent text-accent' : 'bg-transparent border-border text-text-dim'}
                                                    ${isOwner ? 'cursor-pointer hover:border-accent hover:text-accent' : 'cursor-default'}
                                                    ${!isOwner && !active ? 'opacity-30' : ''}`}
                                            >{s}</button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={saveProfile}
                            disabled={isSaving}
                            className={`self-end inline-flex items-center gap-1.5 px-7 py-3 rounded-xl text-sm font-medium text-on-accent shadow-[0_2px_12px_rgba(200,122,48,0.3)] transition-all
                                ${saved ? 'bg-gradient-to-br from-associate to-associate-dark shadow-[0_2px_12px_rgba(93,187,106,0.3)]' : 'bg-gradient-to-br from-accent to-accent-dark hover:-translate-y-px hover:shadow-[0_4px_20px_rgba(200,122,48,0.4)]'}
                                ${isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            {isSaving ? 'Saving...' : saved ? <><Check size={16} className="shrink-0" /> Saved</> : 'Save Changes'}
                        </button>

                        {/* Account Security */}
                        <div className="bg-panel border border-border rounded-2xl mt-2 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setShowAdvanced(v => !v)}
                                    className="w-full bg-transparent flex items-center justify-between px-5 py-4 text-left cursor-pointer"
                                >
                                    <span className="font-serif text-base font-bold text-text">Advanced Settings</span>
                                    <ChevronDown size={18} className={`text-text-dim transition-transform shrink-0 ${showAdvanced ? 'rotate-180' : ''}`} />
                                </button>

                                {showAdvanced && (
                                <div className="flex flex-col gap-5 px-5 pb-5 pt-1">
                                <div className="flex flex-col gap-3">
                                    <div className="text-[11px] text-text-dim tracking-wide uppercase">Change Password</div>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        className="w-full bg-surface border border-border focus:border-accent rounded-[10px] px-3.5 py-2.5 text-text-secondary text-sm outline-none transition-colors"
                                        placeholder="Current password"
                                        value={currentPassword}
                                        onChange={e => setCurrentPassword(e.target.value)}
                                    />
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            className="w-full bg-surface border border-border focus:border-accent rounded-[10px] px-3.5 py-2.5 pr-10 text-text-secondary text-sm outline-none transition-colors"
                                            placeholder="New password (min. 6 characters)"
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(v => !v)}
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent text-text-dim"
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleChangePassword}
                                        disabled={isChangingPassword || !currentPassword || !newPassword}
                                        className="self-start bg-transparent px-5 py-2 rounded-[10px] border border-border text-sm text-text-secondary hover:border-accent hover:text-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isChangingPassword ? 'Changing...' : 'Change Password'}
                                    </button>
                                </div>

                                <div className="flex flex-col gap-3 pt-4 border-t border-border">
                                    <div className="text-[11px] text-danger tracking-wide uppercase">Danger Zone</div>
                                    {!showDeleteConfirm ? (
                                        <button
                                            onClick={() => setShowDeleteConfirm(true)}
                                            className="self-start bg-transparent inline-flex items-center gap-1.5 px-5 py-2 rounded-[10px] border border-danger/40 text-sm text-danger hover:bg-danger/10 transition-colors"
                                        >
                                            <Trash2 size={14} className="shrink-0" /> Delete Account
                                        </button>
                                    ) : (
                                        <div className="flex flex-col gap-2">
                                            <div className="text-xs text-text-dim">This permanently deletes your account. Enter your password to confirm.</div>
                                            <input
                                                type="password"
                                                className="w-full bg-surface border border-danger/40 focus:border-danger rounded-[10px] px-3.5 py-2.5 text-text-secondary text-sm outline-none transition-colors"
                                                placeholder="Password"
                                                value={deletePassword}
                                                onChange={e => setDeletePassword(e.target.value)}
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleDeleteAccount}
                                                    disabled={isDeleting || !deletePassword}
                                                    className="px-5 py-2 rounded-[10px] bg-danger text-on-accent text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                                                </button>
                                                <button
                                                    onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); }}
                                                    className="bg-transparent px-5 py-2 rounded-[10px] border border-border text-sm text-text-dim hover:border-text-dim transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                </div>
                                )}
                            </div>
                        </>)}
                    </div>
                </div>
            </div>
        </>
    )
}
