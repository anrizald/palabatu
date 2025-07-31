import './App.css'
import { Routes, Route, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from "./lib/supabase"
import Auth from './components/Auth'

// Pages
function Home() {
  const [problems, setProblems] = useState([]);

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase.from("problems").select("*");
      if (error) console.error(error);
      else setProblems(data);
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
  const [session, setSession] = useState(null);

  useEffect(() => {
    // get current session
    supabase.auth.getSession().then(({ datra: { session } }) => {
      setSession(session);
    });

    // listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
    }
  }, []);

  return (
    <div className="p-4">
      <nav className="space-x-4">
        <Link to="/" className="text-lg underline">Home</Link>
        <Link to="/about" className="text-lg underline">About</Link>
        <Link to="/auth" className="text-lg underline">Auth</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/auth" element={<Auth />} />
      </Routes>
    </div>
  )
}