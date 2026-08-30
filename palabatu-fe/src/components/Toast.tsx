import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type ToastProps = {
    message: string;
    type: "success" | "error" | "info";
    onClose: () => void;
    /** Optional reversible-action button (e.g. "Undo") rendered inline with
     * the message. Firing it does not by itself dismiss the toast -- call
     * onClose from within onAction if that's also wanted. */
    actionLabel?: string;
    onAction?: () => void;
    /** Auto-close delay in ms. Defaults to 3000; a reversible-action toast
     * usually wants longer so there's time to actually tap the action. */
    duration?: number;
};

export default function Toast({ message, type = "success", onClose, actionLabel, onAction, duration = 3000 }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [onClose, duration]);

    const color = type === "error"
        ? { background: 'rgba(180,60,50,0.95)', border: '1px solid #e07060' }
        : { background: 'rgba(40,80,45,0.95)', border: '1px solid #5dbb6a' };

    return (
        <AnimatePresence>
            {message && (
                <motion.div
                    key="toast"
                    initial={{ x: 100, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 100, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{
                        position: 'fixed', top: 'calc(var(--header-h) + 12px)', right: '16px',
                        padding: '10px 18px', borderRadius: '10px',
                        fontFamily: "'DM Sans', sans-serif", fontSize: '13px',
                        color: '#f0e0c8', zIndex: 999,
                        backdropFilter: 'blur(8px)',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                        display: 'flex', alignItems: 'center', gap: '12px',
                        ...color
                    }}>
                    <span>{message}</span>
                    {actionLabel && onAction && (
                        <button
                            type="button"
                            onClick={onAction}
                            style={{
                                background: 'transparent', border: 'none', padding: 0,
                                color: 'inherit', font: 'inherit', fontWeight: 600,
                                textDecoration: 'underline', cursor: 'pointer', whiteSpace: 'nowrap',
                            }}
                        >
                            {actionLabel}
                        </button>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}