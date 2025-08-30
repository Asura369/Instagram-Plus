import { useEffect, useState } from 'react'
import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
    useLocation
} from 'react-router-dom'

import Navbar from './navbar.jsx'
import Home from './home.jsx'
import Login from './components/Login.jsx'
import Signup from './components/Signup.jsx'
import CreatePost from './components/Create.jsx'
import EditProfile from './components/EditProfile.jsx'
import MyProfile from './components/MyProfile.jsx'
import DiscoverUsers from './components/DiscoverUsers.jsx'
import UserProfile from './components/UserProfile.jsx'
import Stories from './components/Stories.jsx'
// import Messages from './components/Messages.jsx'

function App() {
    const [isLoggedIn, setIsLoggedIn] = useState(false)

    useEffect(() => {
        const token = localStorage.getItem('token')
        setIsLoggedIn(!!token)
    }, [])

    return (
        <BrowserRouter>
            <MainLayout isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} />
        </BrowserRouter>
    )
}

const MainLayout = ({ isLoggedIn, setIsLoggedIn }) => {
    const location = useLocation()
    const hideNavbar = location.pathname === '/login' || location.pathname === '/signup'

    return (
        <div className="app-container">
            {!hideNavbar && <Navbar isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} />}
            <div className="main-content">
                <Routes>
                    <Route
                        path="/"
                        element={isLoggedIn ? <Home /> : <Navigate to="/login" />}
                    />
                    <Route
                        path="/login"
                        element={!isLoggedIn ? <Login setIsLoggedIn={setIsLoggedIn} /> : <Navigate to="/" />}
                    />
                    <Route
                        path="/signup"
                        element={!isLoggedIn ? <Signup /> : <Navigate to="/" />}
                    />
                    <Route
                        path="/create"
                        element={isLoggedIn ? <CreatePost /> : <Navigate to="/login" />}
                    />
                    <Route
                        path="/my-profile"
                        element={isLoggedIn ? <MyProfile /> : <Navigate to="/login" />}
                    />
                    <Route
                        path="/edit-profile"
                        element={isLoggedIn ? <EditProfile /> : <Navigate to="/login" />}
                    />
                    <Route
                        path="/discover"
                        element={isLoggedIn ? <DiscoverUsers /> : <Navigate to="/login" />}
                    />
                    <Route
                        path="/user/:userId"
                        element={isLoggedIn ? <UserProfile /> : <Navigate to="/login" />}
                    />
                    <Route
                        path="/create_story"
                        element={isLoggedIn ? <Stories /> : <Navigate to="/login" />}
                    />
                    {/* <Route
                    path="/messages"
                    element={isLoggedIn ? <Messages /> : <Navigate to="/login" />}
                    /> */}
                </Routes>
            </div>
        </div>
    )
}

export default App
