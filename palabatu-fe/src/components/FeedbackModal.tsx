import { useState } from 'react';

type FeedbackModalProps = {
    onClose: () => void;
    onSubmit: (data: { message: string; email: string }) => void;
    isSubmitting?: boolean;
    showEmailField: boolean;
};

export default function FeedbackModal({ onClose, onSubmit, isSubmitting = false, showEmailField }: FeedbackModalProps) {
    const [message, setMessage] = useState('');
    const [email, setEmail] = useState('');

    return (
        <div
            onClick={onClose}
            className="fixed inset-0 bg-ink/75 backdrop-blur-sm flex items-center justify-center z-[10001] p-4"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="bg-panel border border-border rounded-[20px] w-full max-w-[420px] max-h-[90vh] overflow-y-auto font-sans text-text flex flex-col"
            >
                <div className="px-5 py-4 flex justify-between items-center border-b border-border">
                    <h3 className="font-serif text-lg m-0">Send Feedback</h3>
                    <button onClick={onClose} className="bg-transparent border-0 text-text-muted text-[22px] cursor-pointer leading-none">&times;</button>
                </div>

                <div className="px-5 py-4 flex flex-col gap-3.5">
                    <div className="text-[12px] text-text-dim bg-surface/60 border border-border rounded-xl p-3 leading-relaxed">
                        <span className="text-text-secondary font-bold">Reporting a bug?</span> It helps to include what happened, what you expected instead, and the steps to reproduce it. Ideas and general feedback are welcome too.
                    </div>

                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="What happened, and what did you expect instead?"
                        rows={5}
                        className="w-full resize-y bg-surface border border-border rounded-xl p-3 text-text outline-none font-sans text-[13px] box-border"
                    />

                    {showEmailField && (
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Email (optional, if you want a reply)"
                            className="w-full bg-surface border border-border rounded-xl p-3 text-text outline-none font-sans text-[13px] box-border"
                        />
                    )}

                    <div className="flex gap-2.5 flex-wrap">
                        <button
                            onClick={onClose}
                            className="flex-[1_1_120px] p-2.5 bg-transparent border border-border rounded-[10px] text-text-muted text-[13px] cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => onSubmit({ message: message.trim(), email: email.trim() })}
                            disabled={isSubmitting || !message.trim()}
                            className={`flex-[1_1_120px] p-2.5 bg-accent/15 border border-accent/40 rounded-[10px] text-accent text-[13px] font-bold cursor-pointer ${isSubmitting || !message.trim() ? 'opacity-60' : 'opacity-100'}`}
                        >
                            {isSubmitting ? 'Sending...' : 'Send Feedback'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
