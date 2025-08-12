export default function Landing() {
    return (
        <div className="h-screen w-full snap-y snap-mandatory overflow-y-scroll scroll-smooth ">
            {/* Hero Section */}
            <section className="h-screen w-full snap-start flex flex-col justify-center items-center bg-gradient-to-b from-green-100 to-white text-center">
                <h1 className="text-4xl md:text-6xl font-bold mb-4 text-black">palabatu</h1>
                <p className="text-lg md:text-xl mb-8 text-black">kuat, pinter, boleh</p>
                <a
                    href="/map"
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                > Open Map </a>
            </section>

            {/* About Section */}
            <section className="h-screen w-full snap-start flex flex-col justify-center items-center bg-gradient-to-b from-green-100 to-white text-center">
                <h1 className="text-4xl md:text-6xl font-bold mb-4 text-black">about palabatu</h1>
                <p className="text-lg md:text-xl mb-8 text-black">Lorem Ipsum</p>
            </section>

            {/* Explore Preview Section */}
            <section className="min-h-screen w-full snap-start flex flex-col justify-center items-center bg-gradient-to-b from-green-100 to-white text-center">
                <h1 className="text-4xl md:text-6xl font-bold mb-4 text-black">palabatu</h1>
                <p className="text-lg md:text-xl mb-8">Lorem Ipsum</p>

                {/* Footer Section */}
                <footer className="py-6 text-center text-sm bg-gray-100 text-gray-500 items-end">
                    <p>© {new Date().getFullYear()} palabatu — WC Ass Production.</p>
                    <p>Ghul Dev</p>
                </footer>
            </section>
        </div>
    )
}