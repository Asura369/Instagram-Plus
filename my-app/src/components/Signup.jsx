import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import './Signup.css'
import { API_ENDPOINTS } from '../config/api'

const Signup = () => {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [email, setEmail] = useState('')
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (password !== confirmPassword) {
            alert('Passwords do not match!')
            return
        }

        console.log('username', username)
        console.log('password', password)
        console.log('confirmpass', confirmPassword)
        console.log('email', email)

        try {
            const res = await axios.post(API_ENDPOINTS.register, {
                username,
                email,
                password
            })

            console.log('SignUp Res: ', res)

            alert('Account created successfully!')
            navigate('/login')
        } catch (err) {
            alert(err.response?.data?.message || 'Error creating account')
        }
    }

    return (
        <div className="signup-page">
            <div className="signup-container">
                <img src="/logoo.png" alt="Instagram Plus Logo" className="auth-logo" />
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
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
                    <input
                        type="password"
                        placeholder="Confirm Password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                    />
                    <button type="submit">Sign Up</button>
                </form>

                <p>
                    Already have an account?{' '}
                    <Link to="/login" className="login-link">Login here</Link>
                </p>
            </div>
        </div>
    )
}

export default Signup
