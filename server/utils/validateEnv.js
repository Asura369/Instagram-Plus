// Environment variables validation
export function validateEnvironment() {
    const required = [
        'MONGODB_URI',
        'JWT_SECRET',
        'CLOUDINARY_CLOUD_NAME',
        'CLOUDINARY_API_KEY',
        'CLOUDINARY_API_SECRET',
        'GEMINI_API_KEY'
    ];

    const missing = [];
    const present = [];

    for (const envVar of required) {
        if (!process.env[envVar]) {
            missing.push(envVar);
        } else {
            present.push(envVar);
        }
    }

    console.log('=== Environment Variables Status ===');
    console.log('✅ Present:', present);
    if (missing.length > 0) {
        console.log('❌ Missing:', missing);
        console.warn('Warning: Some required environment variables are missing');
        return false;
    } else {
        console.log('✅ All required environment variables are present');
        return true;
    }
}

export default validateEnvironment;
