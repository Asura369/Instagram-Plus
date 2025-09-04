import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import './navbar.css'
import { AiOutlineHome } from 'react-icons/ai'
import { FiSearch, FiLogOut } from 'react-icons/fi'
import { BiMessageSquareDetail, BiPlusCircle } from 'react-icons/bi'
import { FaRegUserCircle } from 'react-icons/fa'
import { MdOutlineAddPhotoAlternate } from 'react-icons/md'
import { BsCameraReels } from 'react-icons/bs'

const Navbar = ({ isLoggedIn, setIsLoggedIn }) => {
    const navigate = useNavigate()
    const location = useLocation()
    const [showCreate, setShowCreate] = useState(false)

    const handleLogout = () => {
        localStorage.removeItem('token')
        setIsLoggedIn(false)
        navigate('/login')
    }

    const Item = ({ to, icon: Icon, label }) => {
        const active = location.pathname === to
        return (
            <Link to={to} className={`ig-nav-item ${active ? 'active' : ''}`}>
                <Icon size={22} />
                <span className="ig-label">{label}</span>
            </Link>
        )
    }

    return (
        <nav className="ig-nav">
            <div className="ig-logo" onClick={() => navigate('/')}>
                <img src="/logoo.png" alt="Instagram Plus Logo" className="navbar-logo" />
            </div>

            <div className="ig-nav-list">
                <Item to="/" icon={AiOutlineHome} label="Home" />

                {isLoggedIn && (
                    <>
                        <Item to="/discover" icon={FiSearch} label="Search" />
                        <Item to="/messages" icon={BiMessageSquareDetail} label="Messages" />

                        <div
                            className="ig-create-wrap"
                            onMouseEnter={() => setShowCreate(true)}
                            onMouseLeave={() => setShowCreate(false)}
                        >
                            <button className="ig-nav-item ig-button">
                                <BiPlusCircle size={22} />
                                <span className="ig-label">Create</span>
                            </button>

                            {showCreate && (
                                <div className="ig-create-popover">
                                    <Link to="/create" className="ig-create-item">
                                        <MdOutlineAddPhotoAlternate size={18} />
                                        <span>New Post</span>
                                    </Link>
                                    <Link to="/create_story" className="ig-create-item">
                                        <BsCameraReels size={18} />
                                        <span>New Story</span>
                                    </Link>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {!isLoggedIn && (
                    <>
                        <Item to="/login" icon={FaRegUserCircle} label="Login" />
                        <Item to="/signup" icon={FaRegUserCircle} label="Signup" />
                    </>
                )}
            </div>

            {isLoggedIn && (
                <div className="ig-bottom">
                    <Item to="/my-profile" icon={FaRegUserCircle} label="Profile" />
                    <button className="ig-nav-item ig-button" onClick={handleLogout}>
                        <FiLogOut size={22} />
                        <span className="ig-label">Logout</span>
                    </button>
                </div>
            )}
        </nav>
    )
}

export default Navbar
