import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type ToastProps = {
    message: string;
    type: "success" | "error" | "info";
    onClose: () => void;
};

export default function Toast({ message, type = "success", onClose }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 3000); // Auto close after 3 seconds

        return () => clearTimeout(timer);
    }, [onClose]);

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
                        position: 'fixed', top: '72px', right: '16px',
                        padding: '10px 18px', borderRadius: '10px',
                        fontFamily: "'DM Sans', sans-serif", fontSize: '13px',
                        color: '#f0e0c8', zIndex: 999,
                        backdropFilter: 'blur(8px)',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                        ...color
                    }}>
                    {message}
                </motion.div>
            )}
        </AnimatePresence>
    );
}