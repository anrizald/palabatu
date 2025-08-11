import { useEffect } from 'react';

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
        <div className={`fixed top-4 right-4 text-white px-4 py-2 rounded shadow ${color}`}>
            {message}
        </div>
    );
}