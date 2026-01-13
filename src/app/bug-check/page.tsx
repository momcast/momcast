
export default function BugCheckPage() {
    const envStatus = {
        AUTH_SECRET: process.env.AUTH_SECRET ? 'OK (Exists)' : 'MISSING (!!!)',
        AUTH_URL: process.env.AUTH_URL ? `OK (${process.env.AUTH_URL})` : 'MISSING (!!!)',
        AUTH_NAVER_ID: process.env.AUTH_NAVER_ID ? `OK (${process.env.AUTH_NAVER_ID.substring(0, 5)}...)` : 'MISSING (!!!)',
        AUTH_NAVER_SECRET: process.env.AUTH_NAVER_SECRET ? `OK (Start: ${process.env.AUTH_NAVER_SECRET.substring(0, 3)}, Len: ${process.env.AUTH_NAVER_SECRET.length})` : 'MISSING (!!!)',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? `OK (Len: ${process.env.SUPABASE_SERVICE_ROLE_KEY.length})` : 'MISSING (!!!)',
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? `OK (${process.env.NEXT_PUBLIC_SUPABASE_URL})` : 'MISSING (!!!)',
    };

    return (
        <div style={{ padding: '50px', fontFamily: 'monospace' }}>
            <h1>Environment Variable Check</h1>
            <p>If any of these say &quot;MISSING&quot;, that is the cause of the 500 Error.</p>

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
