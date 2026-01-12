
export default function BugCheckPage() {
    const envStatus = {
        AUTH_SECRET: process.env.AUTH_SECRET ? 'OK (Exists)' : 'MISSING (!!!)',
        AUTH_NAVER_ID: process.env.AUTH_NAVER_ID ? 'OK (Exists)' : 'MISSING (!!!)',
        AUTH_NAVER_SECRET: process.env.AUTH_NAVER_SECRET ? 'OK (Exists)' : 'MISSING (!!!)',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'OK (Exists)' : 'MISSING (!!!)',
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'OK (Exists)' : 'MISSING (!!!)',
    };

    return (
        <div style={{ padding: '50px', fontFamily: 'monospace' }}>
            <h1>Environment Variable Check</h1>
            <p>If any of these say "MISSING", that is the cause of the 500 Error.</p>

            <div style={{ background: '#f0f0f0', padding: '20px', borderRadius: '8px' }}>
                {Object.entries(envStatus).map(([key, status]) => (
                    <div key={key} style={{ margin: '10px 0', fontSize: '16px' }}>
                        <strong>{key}:</strong>
                        <span style={{
                            color: status.includes('MISSING') ? 'red' : 'green',
                            fontWeight: 'bold',
                            marginLeft: '10px'
                        }}>
                            {status}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
