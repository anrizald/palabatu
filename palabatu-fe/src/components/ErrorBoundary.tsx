import { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryProps = {
    children: ReactNode;
};

type ErrorBoundaryState = {
    hasError: boolean;
};

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { hasError: false };

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('Unhandled error in app tree', error, info);
    }

    render() {
        if (!this.state.hasError) return this.props.children;

        return (
            <div style={{
                minHeight: '100vh', background: '#0f0d0b', color: '#f0e0c8',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '16px', padding: '24px', textAlign: 'center'
            }}>
                <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@900&family=DM+Sans:wght@400&display=swap');`}</style>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '28px', fontWeight: 900, color: '#c87a30' }}>
                    Something slipped
                </div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: '#8a7060' }}>
                    The app hit an unexpected error. Try reloading the page.
                </div>
                <button
                    onClick={() => window.location.reload()}
                    style={{
                        marginTop: '8px', fontFamily: "'DM Sans', sans-serif", fontSize: '13px',
                        padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                        background: 'linear-gradient(145deg, #c87a30, #8b4a18)', color: '#fef3e6', fontWeight: 500
                    }}
                >
                    Reload
                </button>
            </div>
        );
    }
}
