import './App.css'
import 'leaflet/dist/leaflet.css'
import { useEffect, useState } from 'react'
import { api } from "./lib/api.js"
import { Header } from './components/index.js'
import { VerifyEmail } from './pages/index.js'
import { Routes, Route } from 'react-router-dom'
import { MapPage, Landing, Profile, Login, Signup } from './pages/index.js'

// Pages
type ProblemRow = {
  id: string | number
  name: string
  location_name: string
}
function Home() {
  const [problems, setProblems] = useState<ProblemRow[]>([]);

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await api.get('api/problems');
      if (error) console.error(error);
      else if (data) setProblems(data as ProblemRow[]);
    }

    fetchData();
  }, []);

  return (
    <div>
      <div>
        <h1 className="text-xl font-bold mb-4">Home Page</h1>
        <p>Welcome to the home page!</p>
      </div>
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4">Problems from Supabase</h1>
        <ul className="space-y-2">
          {problems.map((problem) => (
            <li key={problem.id} className="border p-2 rounded">
              <p className="font-semibold">{problem.name}</p>
              <p className="text-sm text-gray-600">{problem.location_name}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function About() {
  return (
    <div>
      <h1 className="text-blue-500">About Page</h1>
      <p>Welcome to the about page!</p>
    </div>
  )
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(!!localStorage.getItem('token'));

  useEffect(() => {
    const handleStorageChange = () => {
      setIsLoggedIn(!!localStorage.getItem('token'));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      {/* <div className="flex-1 overflow-y-auto ">
      </div> */}

      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
        </Routes>
      </main>
    </div >
  )
}