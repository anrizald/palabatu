import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type ToastProps = {
    message: string;
    type: "success" | "error";
    onClose: () => void;
};

export default function Toast({ message, type = "success", onClose }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 3000); // Auto close after 3 seconds

        return () => clearTimeout(timer);
    }, [onClose]);

    const color = type === "error" ? "bg-red-500" : "bg-green-500";

    return (
        <AnimatePresence>
            {message && (
                <motion.div
                    key="toast"
                    initial={{ x: 100, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 100, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`fixed top-20 right-4 text-white px-4 py-2 rounded shadow ${color}`}>
                    {message}
                </motion.div>
            )}
        </AnimatePresence>
    );
}