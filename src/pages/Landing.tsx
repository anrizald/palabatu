import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

export default function Landing() {
    const [problems, setProblems] = useState<any[]>([]);

    useEffect(() => {
        async function fetchProblems() {
            const data = await api.get('/api/problems');
            if (data.error) {
                console.error("Error fetching problems:", data.error);
            } else {
                setProblems(data || []);
            }

        }
        fetchProblems();
    }, []);

    return (
        <div className="h-screen w-full snap-y snap-mandatory overflow-y-scroll scroll-smooth ">
            {/* Hero Section */}
            <section className="h-screen w-full snap-start flex flex-col justify-center items-center bg-gradient-to-b from-green-100 to-white text-center">
                <p className="text-3xl md:text-5xl mb-6 text-black">kuat, pinter, boleh</p>
                <a
                    href="/map"
                    className="mb-8 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                > Open Map </a>

                {/* Recently Added Problems Section */}
                {/* <section className="min-h-[60vh] w-full snap-start flex flex-col justify-center items-center bg-gradient-to-b from-white to-green-100 text-center px-6"> */}
                <div className="w-full max-w-6xl mt-4">
                    <h2 className="text-2xl md:text-3xl font-bold mb-4 text-black">Recently Added Problems</h2>
                    <div className="w-full max-w-6xl overflow-x-auto flex gap-6 pb-4 scrollbar-hide">
                        {problems.length > 0 ? (
                            problems.map((problem) => (
                                <div
                                    key={problem.id}
                                    className="min-w-[250px] bg-white rounded-2xl shadow-lg p-4 hover:scale-105 transition"
                                >
                                    <h3 className="text-xl font-semibold text-green-700 mb-2">{problem.name || "Problem Name"}</h3>
                                    <p className="text-gray-600 text-sm">{problem.location_name || "Unknown Location"}</p>
                                    <p className="text-gray-400 text-xs mt-2">Grade: {problem.grade || "—"}</p>
                                </div>
                            ))
                        ) : (
                            // Dummy placeholders if DB empty
                            [...Array(5)].map((_, i) => (
                                <div
                                    key={i}
                                    className="min-w-[250px] bg-white rounded-2xl shadow-lg p-4 animate-pulse"
                                >
                                    <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div>
                                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                                    <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
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