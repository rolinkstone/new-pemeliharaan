// pages/test-api.js
import { useState } from 'react';
import { useSession } from 'next-auth/react';

export default function TestApiPage() {
  const { data: session } = useSession();
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const testHealth = async () => {
    setLoading(true);
    setResult('Testing...');
    
    try {
      // Hardcode URL
      const response = await fetch('http://localhost:5002/api/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const text = await response.text();
      setResult(`Status: ${response.status}\nResponse: ${text}`);
    } catch (error) {
      setResult(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testWithToken = async () => {
    setLoading(true);
    setResult('Testing...');
    
    // Dapatkan token
    const token = session?.accessToken || localStorage.getItem('token');
    
    if (!token) {
      setResult('Error: No token found');
      setLoading(false);
      return;
    }
    
    try {
      const response = await fetch('http://localhost:5002/api/asetRuangan', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      const text = await response.text();
      setResult(`Status: ${response.status}\nResponse: ${text}`);
    } catch (error) {
      setResult(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Test API Connection</h1>
      
      <div style={{ marginBottom: '10px' }}>
        <button 
          onClick={testHealth}
          disabled={loading}
          style={{ marginRight: '10px', padding: '10px' }}
        >
          Test Health (No Auth)
        </button>
        
        <button 
          onClick={testWithToken}
          disabled={loading}
          style={{ padding: '10px' }}
        >
          Test AsetRuangan (With Token)
        </button>
      </div>
      
      <pre style={{ 
        background: '#f0f0f0', 
        padding: '20px', 
        borderRadius: '5px',
        whiteSpace: 'pre-wrap',
        wordWrap: 'break-word'
      }}>
        {result || 'Click a button to test'}
      </pre>
    </div>
  );
}