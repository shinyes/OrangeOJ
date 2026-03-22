import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import { api } from '../api'

const editorLang = {
  cpp: 'cpp',
  python: 'python',
  go: 'go'
}

function normalizeDefaultLanguage(language) {
  if (language === 'python') return 'python'
  if (language === 'go') return 'go'
  return 'cpp'
}

function pickStarter(body, language) {
  if (!body?.starterCode) {
    if (language === 'python') return 'print("hello")'
    if (language === 'go') {
      return 'package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("hello")\n}'
    }
    return '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  return 0;\n}'
  }
  return body.starterCode[language] || body.starterCode.cpp || ''
}

function problemTypeText(type) {
  if (type === 'single_choice') return '单选题'
  if (type === 'true_false') return '判断题'
  return type
}

function nowTimeText() {
  return new Date().toLocaleTimeString()
}

export default function CodingPage() {
  const { spaceId, problemId } = useParams()
  const [problem, setProblem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [language, setLanguage] = useState('cpp')
  const [code, setCode] = useState('')
  const [customInput, setCustomInput] = useState('')
  const [consoleText, setConsoleText] = useState('控制台已就绪')
  const [running, setRunning] = useState(false)

  const [objectiveAnswer, setObjectiveAnswer] = useState('')

  const body = useMemo(() => problem?.bodyJson || {}, [problem])

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        const [data, space] = await Promise.all([
          api.getProblem(spaceId, problemId),
          api.getSpace(spaceId)
        ])
        const defaultLanguage = normalizeDefaultLanguage(space?.defaultProgrammingLanguage)
        setLanguage(defaultLanguage)
        setProblem(data)
        if (data.type === 'programming') {
          const key = `orangeoj:code:${spaceId}:${problemId}:${defaultLanguage}`
          const cached = localStorage.getItem(key)
          setCode(cached || pickStarter(data.bodyJson, defaultLanguage))
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [spaceId, problemId])

  useEffect(() => {
    if (!problem || problem.type !== 'programming') return
    const key = `orangeoj:code:${spaceId}:${problemId}:${language}`
    const cached = localStorage.getItem(key)
    setCode(cached || pickStarter(problem.bodyJson, language))
  }, [language, problem, spaceId, problemId])

  const saveDraft = () => {
    const key = `orangeoj:code:${spaceId}:${problemId}:${language}`
    localStorage.setItem(key, code)
    setConsoleText((prev) => `${prev}\n[${nowTimeText()}] 草稿已保存到本地`)
  }

  const pollSubmission = async (submissionId) => {
    for (let i = 0; i < 180; i += 1) {
      const snapshot = await api.pollSubmission(submissionId)
      setConsoleText(
        `${snapshot.stdout || ''}\n${snapshot.stderr || ''}\n状态: ${snapshot.status} / ${snapshot.verdict || ''}`
      )
      if (snapshot.status === 'done' || snapshot.status === 'failed') {
        return snapshot
      }
      await new Promise((resolve) => setTimeout(resolve, snapshot.pollAfterMs || 1000))
    }
    throw new Error('判题等待超时，请稍后再试')
  }

  const handleCodeSubmit = async (mode) => {
    if (!problem || problem.type !== 'programming') return

    setRunning(true)
    setError('')
    const actionText = mode === 'run' ? '运行' : mode === 'test' ? '测试' : '提交'
    setConsoleText(`[${nowTimeText()}] 开始${actionText}...`)

    try {
      const payload = {
        language,
        sourceCode: code,
        inputData: customInput
      }

      const created = mode === 'run'
        ? await api.run(spaceId, problemId, payload)
        : mode === 'test'
          ? await api.test(spaceId, problemId, payload)
          : await api.submit(spaceId, problemId, payload)

      const result = await pollSubmission(created.submissionId)
      setConsoleText(
        (prev) => `${prev}\n\n最终结果: ${result.verdict || '-'} | ${(result.timeMs || 0)}ms | ${(result.memoryKiB || 0)}KiB`
      )
    } catch (err) {
      setError(err.message)
      setConsoleText((prev) => `${prev}\n错误: ${err.message}`)
    } finally {
      setRunning(false)
    }
  }

  const handleObjectiveSubmit = async () => {
    try {
      setRunning(true)
      setError('')
      const answer = problem.type === 'true_false' ? objectiveAnswer === 'true' : objectiveAnswer
      const result = await api.objectiveSubmit(spaceId, problemId, answer)
      setConsoleText(`判定结果: ${result.verdict} | 得分: ${result.score}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setRunning(false)
    }
  }

  if (loading) {
    return <div className="screen-center">题目加载中...</div>
  }

  if (error && !problem) {
    return (
      <div className="page-shell">
        <div className="error-box">{error}</div>
        <Link className="ghost-btn" to="/">返回首页</Link>
      </div>
    )
  }

  if (!problem) {
    return <div className="screen-center">题目不存在</div>
  }

  if (problem.type !== 'programming') {
    return (
      <div className="page-shell">
        <header className="topbar">
          <div>
            <h1>{problem.title}</h1>
            <p>{problemTypeText(problem.type)}</p>
          </div>
          <Link className="ghost-btn" to="/">返回首页</Link>
        </header>

        {error && <div className="error-box">{error}</div>}

        <section className="panel">
          <pre className="statement">{problem.statementMd}</pre>

          {problem.type === 'single_choice' ? (
            <div className="choice-grid">
              {(body.options || []).map((opt) => (
                <label key={String(opt)} className="choice-item">
                  <input
                    type="radio"
                    name="singleChoice"
                    value={String(opt)}
                    checked={objectiveAnswer === String(opt)}
                    onChange={(event) => setObjectiveAnswer(event.target.value)}
                  />
                  <span>{String(opt)}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="inline-form">
              <label>
                <input
                  type="radio"
                  name="tf"
                  value="true"
                  checked={objectiveAnswer === 'true'}
                  onChange={(event) => setObjectiveAnswer(event.target.value)}
                />
                正确
              </label>
              <label>
                <input
                  type="radio"
                  name="tf"
                  value="false"
                  checked={objectiveAnswer === 'false'}
                  onChange={(event) => setObjectiveAnswer(event.target.value)}
                />
                错误
              </label>
            </div>
          )}

          <button disabled={running || !objectiveAnswer} onClick={handleObjectiveSubmit}>
            {running ? '提交中...' : '提交答案'}
          </button>

          <pre className="console-box">{consoleText}</pre>
        </section>
      </div>
    )
  }

  const samples = body.samples || []

  return (
    <div className="coder-shell">
      <div className="coder-topbar">
        <div>
          <h1>{problem.title}</h1>
          <p>时间限制: {problem.timeLimitMs}ms | 内存限制: {problem.memoryLimitMiB}MiB</p>
        </div>
        <Link to="/" className="ghost-btn">返回首页</Link>
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="coder-grid">
        <section className="statement-panel">
          <h2>题目描述</h2>
          <pre className="statement">{problem.statementMd}</pre>

          <h3>输入格式</h3>
          <p>{body.inputFormat || '见题目描述'}</p>

          <h3>输出格式</h3>
          <p>{body.outputFormat || '见题目描述'}</p>

          <h3>样例</h3>
          {samples.length === 0 && <p>暂无样例</p>}
          {samples.map((sample, index) => (
            <div key={index} className="sample-box">
              <div>
                <strong>输入样例 {index + 1}</strong>
                <pre>{sample.input || '(空)'}</pre>
              </div>
              <div>
                <strong>输出样例 {index + 1}</strong>
                <pre>{sample.output || '(空)'}</pre>
              </div>
            </div>
          ))}

          <h3>限制</h3>
          <p>时间限制: {problem.timeLimitMs}ms</p>
          <p>内存限制: {problem.memoryLimitMiB}MiB</p>
        </section>

        <section className="editor-panel">
          <div className="editor-actions">
            <select value={language} onChange={(event) => setLanguage(event.target.value)}>
              <option value="cpp">C++17</option>
              <option value="python">Python 3.8</option>
              <option value="go">Go 1.25</option>
            </select>
            <button className="run-btn" disabled={running} onClick={() => handleCodeSubmit('run')}>运行</button>
            <button className="test-btn" disabled={running} onClick={() => handleCodeSubmit('test')}>测试</button>
            <button className="save-btn" onClick={saveDraft}>保存</button>
            <button className="submit-btn" disabled={running} onClick={() => handleCodeSubmit('submit')}>提交</button>
          </div>

          <div className="editor-wrap">
            <Editor
              theme="vs"
              language={editorLang[language]}
              value={code}
              onChange={(value) => setCode(value || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 15,
                tabSize: 2,
                automaticLayout: true
              }}
            />
          </div>

          <label>自定义输入（运行模式）</label>
          <textarea
            className="io-input"
            value={customInput}
            onChange={(event) => setCustomInput(event.target.value)}
            placeholder="请输入运行模式的输入内容"
          />

          <label>控制台输出</label>
          <pre className="console-box">{consoleText}</pre>
        </section>
      </div>
    </div>
  )
}
