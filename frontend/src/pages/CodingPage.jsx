import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import { api } from '../api'

const editorLang = {
  cpp: 'cpp',
  python: 'python',
  go: 'go'
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

export default function CodingPage() {
  const { spaceId, problemId } = useParams()
  const [problem, setProblem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [language, setLanguage] = useState('cpp')
  const [code, setCode] = useState('')
  const [customInput, setCustomInput] = useState('')
  const [consoleText, setConsoleText] = useState('No output yet')
  const [running, setRunning] = useState(false)

  const [objectiveAnswer, setObjectiveAnswer] = useState('')

  const body = useMemo(() => problem?.bodyJson || {}, [problem])

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        const data = await api.getProblem(spaceId, problemId)
        setProblem(data)
        if (data.type === 'programming') {
          const key = `orangeoj:code:${spaceId}:${problemId}:${language}`
          const cached = localStorage.getItem(key)
          setCode(cached || pickStarter(data.bodyJson, language))
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
    setConsoleText((prev) => `${prev}\n[save] draft stored in localStorage`)
  }

  const pollSubmission = async (submissionId) => {
    for (let i = 0; i < 180; i += 1) {
      const snapshot = await api.pollSubmission(submissionId)
      const data = snapshot
      setConsoleText(`${data.stdout || ''}\n${data.stderr || ''}\nStatus: ${data.status} / ${data.verdict || ''}`)
      if (data.status === 'done' || data.status === 'failed') {
        return data
      }
      await new Promise((resolve) => setTimeout(resolve, snapshot.pollAfterMs || 1000))
    }
    throw new Error('Judge timeout')
  }

  const handleCodeSubmit = async (mode) => {
    if (!problem || problem.type !== 'programming') return

    setRunning(true)
    setError('')
    setConsoleText(`[${new Date().toLocaleTimeString()}] ${mode} started...`)

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
      setConsoleText((prev) => `${prev}\n\nFinal: ${result.verdict} | ${result.timeMs || 0}ms | ${result.memoryKiB || 0}KiB`)
    } catch (err) {
      setError(err.message)
      setConsoleText((prev) => `${prev}\nError: ${err.message}`)
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
      setConsoleText(`Result: ${result.verdict} | score: ${result.score}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setRunning(false)
    }
  }

  if (loading) {
    return <div className="screen-center">Loading problem...</div>
  }

  if (error && !problem) {
    return (
      <div className="page-shell">
        <div className="error-box">{error}</div>
        <Link className="ghost-btn" to="/">Back</Link>
      </div>
    )
  }

  if (!problem) {
    return <div className="screen-center">Problem not found.</div>
  }

  if (problem.type !== 'programming') {
    return (
      <div className="page-shell">
        <header className="topbar">
          <div>
            <h1>{problem.title}</h1>
            <p>{problem.type}</p>
          </div>
          <Link className="ghost-btn" to="/">Back</Link>
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
                    onChange={(e) => setObjectiveAnswer(e.target.value)}
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
                  onChange={(e) => setObjectiveAnswer(e.target.value)}
                />
                True
              </label>
              <label>
                <input
                  type="radio"
                  name="tf"
                  value="false"
                  checked={objectiveAnswer === 'false'}
                  onChange={(e) => setObjectiveAnswer(e.target.value)}
                />
                False
              </label>
            </div>
          )}

          <button disabled={running} onClick={handleObjectiveSubmit}>
            {running ? 'Submitting...' : 'Submit'}
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
          <p>Time limit: {problem.timeLimitMs}ms | Memory limit: {problem.memoryLimitMiB}MiB</p>
        </div>
        <Link to="/" className="ghost-btn">Back</Link>
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="coder-grid">
        <section className="statement-panel">
          <h2>Description</h2>
          <pre className="statement">{problem.statementMd}</pre>

          <h3>Input</h3>
          <p>{body.inputFormat || 'See statement'}</p>

          <h3>Output</h3>
          <p>{body.outputFormat || 'See statement'}</p>

          <h3>Samples</h3>
          {samples.length === 0 && <p>No samples</p>}
          {samples.map((sample, index) => (
            <div key={index} className="sample-box">
              <div>
                <strong>Sample Input {index + 1}</strong>
                <pre>{sample.input || '(empty)'}</pre>
              </div>
              <div>
                <strong>Sample Output {index + 1}</strong>
                <pre>{sample.output || '(empty)'}</pre>
              </div>
            </div>
          ))}

          <h3>Limits</h3>
          <p>Time: {problem.timeLimitMs}ms</p>
          <p>Memory: {problem.memoryLimitMiB}MiB</p>
        </section>

        <section className="editor-panel">
          <div className="editor-actions">
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="cpp">C++17</option>
              <option value="python">Python 3.8</option>
              <option value="go">Go 1.25</option>
            </select>
            <button className="run-btn" disabled={running} onClick={() => handleCodeSubmit('run')}>Run</button>
            <button className="test-btn" disabled={running} onClick={() => handleCodeSubmit('test')}>Test</button>
            <button className="save-btn" onClick={saveDraft}>Save</button>
            <button className="submit-btn" disabled={running} onClick={() => handleCodeSubmit('submit')}>Submit</button>
          </div>

          <div className="editor-wrap">
            <Editor
              theme="vs-light"
              language={editorLang[language]}
              value={code}
              onChange={(value) => setCode(value || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 16,
                tabSize: 2,
                automaticLayout: true
              }}
            />
          </div>

          <label>Custom input (for Run)</label>
          <textarea
            className="io-input"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Type input for run mode"
          />

          <label>Console</label>
          <pre className="console-box">{consoleText}</pre>
        </section>
      </div>
    </div>
  )
}
