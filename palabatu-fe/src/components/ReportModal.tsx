import { useState } from 'react';

export type ReportTarget =
    | { type: 'comment'; id: string; content: string }
    | { type: 'image'; url: string };

type ReportModalProps = {
    target: ReportTarget;
    onClose: () => void;
    onSubmit: (reason: string) => void;
    isSubmitting?: boolean;
};

export default function ReportModal({ target, onClose, onSubmit, isSubmitting = false }: ReportModalProps) {
    const [reason, setReason] = useState('');

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(10, 9, 8, 0.75)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 10001, padding: '16px'
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: '#141210', border: '1px solid #2a2420', borderRadius: '20px',
                    width: '100%', maxWidth: '420px', maxHeight: '90vh', overflowY: 'auto',
                    fontFamily: "'DM Sans', sans-serif", color: '#f0e0c8',
                    display: 'flex', flexDirection: 'column'
                }}
            >
                <div style={{
                    padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderBottom: '1px solid #2a2420'
                }}>
                    <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', margin: 0 }}>
                        Report {target.type === 'comment' ? 'Comment' : 'Image'}
                    </h3>
                    <button onClick={onClose} style={{
                        background: 'none', border: 'none', color: '#8a7060', fontSize: '22px', cursor: 'pointer', lineHeight: 1
                    }}>&times;</button>
                </div>

                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {target.type === 'comment' ? (
                        <div style={{
                            fontSize: '13px', color: '#d8c8b8', background: 'rgba(20,18,16,0.5)',
                            padding: '12px', borderRadius: '12px', border: '1px solid #2a2420', lineHeight: 1.4
                        }}>
                            {target.content}
                        </div>
                    ) : (
                        <img
                            src={target.url}
                            alt="Reported content"
                            style={{
                                width: '100%', maxHeight: '200px', objectFit: 'cover',
                                borderRadius: '12px', border: '1px solid #2a2420'
                            }}
                        />
                    )}

                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Why are you reporting this? (optional)"
                        rows={3}
                        style={{
                            width: '100%', resize: 'vertical', background: '#1a1612',
                            border: '1px solid #2a2420', borderRadius: '12px', padding: '12px',
                            color: '#f0e0c8', outline: 'none', fontFamily: "'DM Sans', sans-serif", fontSize: '13px',
                            boxSizing: 'border-box'
                        }}
                    />

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                            onClick={onClose}
                            style={{
                                flex: '1 1 120px', padding: '10px', background: 'transparent',
                                border: '1px solid #2a2420', borderRadius: '10px', color: '#8a7060',
                                fontSize: '13px', cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => onSubmit(reason.trim())}
                            disabled={isSubmitting}
                            style={{
                                flex: '1 1 120px', padding: '10px', background: 'rgba(220, 53, 69, 0.15)',
                                border: '1px solid rgba(220, 53, 69, 0.4)', borderRadius: '10px', color: '#dc3545',
                                fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                                opacity: isSubmitting ? 0.6 : 1
                            }}
                        >
                            {isSubmitting ? 'Reporting...' : 'Submit Report'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
