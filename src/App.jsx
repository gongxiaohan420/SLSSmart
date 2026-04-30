import { useState, useEffect } from 'react'

function App() {
  const [status, setStatus] = useState('加载中...')

  useEffect(() => {
    // 测试后端连接
    fetch('http://localhost:4000/api/status')
      .then(res => res.json())
      .then(data => {
        setStatus(`后端连接正常: ${data.message}`)
      })
      .catch(err => {
        setStatus('后端连接失败，请检查后端服务是否启动')
      })
  }, [])

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">全栈项目</h1>
        <p className="text-gray-600 mb-4">前端: Vite + React + Tailwind CSS</p>
        <p className="text-gray-600 mb-6">后端: Node.js + Express + SQLite</p>
        <div className="bg-gray-50 rounded p-4 mb-6">
          <p className="text-sm text-gray-700">{status}</p>
        </div>
        <div className="flex justify-center">
          <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
            开始使用
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
