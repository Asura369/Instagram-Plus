import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import './Login.css'
import { setToken } from '../auth/simpleAuth'

const Login = ({ setIsLoggedIn }) => {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()

        try {
            const res = await axios.post('http://localhost:5000/auth/login', {
                email,
                password
            })

            localStorage.setItem('token', res.data.token)
            setIsLoggedIn(true)
            setToken(res.data.token)
            navigate('/Home')
        } catch (err) {
            alert(err.response?.data?.message || 'Login failed')
        }
    }

    return (
        <div className="login-container">
            <h2>Login</h2>
            <form onSubmit={handleSubmit}>
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                <button type="submit">Login</button>
            </form>

            <p>
                Don't have an account?{' '}
                <Link to="/signup" className="signup-link">Sign up here</Link>
            </p>
        </div>
    )
}

export default Login
