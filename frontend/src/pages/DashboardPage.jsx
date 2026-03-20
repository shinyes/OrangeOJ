import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'

function asPretty(value) {
  return JSON.stringify(value, null, 2)
}

function defaultBody(type) {
  if (type === 'programming') {
    return {
      inputFormat: 'Input format here',
      outputFormat: 'Output format here',
      samples: [{ input: '', output: '' }],
      testCases: [{ input: '', output: '' }],
      starterCode: {
        cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  return 0;\n}',
        python: 'print("hello")',
        go: 'package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("hello")\n}'
      }
    }
  }
  if (type === 'single_choice') {
    return { options: ['A', 'B', 'C', 'D'] }
  }
  return {}
}

function defaultAnswer(type) {
  if (type === 'single_choice') return { answer: 'A' }
  if (type === 'true_false') return { answer: true }
  return {}
}

export default function DashboardPage({ user, onLogout }) {
  const [error, setError] = useState('')

  const [spaces, setSpaces] = useState([])
  const [selectedSpaceId, setSelectedSpaceId] = useState(null)

  const [rootProblems, setRootProblems] = useState([])
  const [registrationEnabled, setRegistrationEnabled] = useState(false)

  const [spaceProblems, setSpaceProblems] = useState([])
  const [trainingPlans, setTrainingPlans] = useState([])
  const [homeworks, setHomeworks] = useState([])

  const [activeTab, setActiveTab] = useState('problems')

  const [newSpaceName, setNewSpaceName] = useState('')
  const [newSpaceDesc, setNewSpaceDesc] = useState('')

  const [problemType, setProblemType] = useState('programming')
  const [problemTitle, setProblemTitle] = useState('')
  const [problemStatement, setProblemStatement] = useState('')
  const [problemBodyJson, setProblemBodyJson] = useState(asPretty(defaultBody('programming')))
  const [problemAnswerJson, setProblemAnswerJson] = useState(asPretty(defaultAnswer('programming')))

  const [linkProblemId, setLinkProblemId] = useState('')
  const [planTitle, setPlanTitle] = useState('')
  const [homeworkTitle, setHomeworkTitle] = useState('')

  const selectedSpace = useMemo(
    () => spaces.find((space) => space.id === selectedSpaceId) || null,
    [spaces, selectedSpaceId]
  )

  const refreshSpaces = async () => {
    const list = await api.listSpaces()
    setSpaces(list)
    if (!selectedSpaceId && list.length > 0) {
      setSelectedSpaceId(list[0].id)
    }
  }

  const refreshAdminData = async () => {
    if (user.globalRole !== 'system_admin') return
    const [registration, problems] = await Promise.all([
      api.getRegistration(),
      api.listRootProblems()
    ])
    setRegistrationEnabled(Boolean(registration.enabled))
    setRootProblems(problems)
  }

  const refreshSpaceData = async (spaceId) => {
    if (!spaceId) return
    const [problems, plans, hw] = await Promise.all([
      api.listSpaceProblems(spaceId),
      api.listTrainingPlans(spaceId),
      api.listHomeworks(spaceId)
    ])
    setSpaceProblems(problems)
    setTrainingPlans(plans)
    setHomeworks(hw)
  }

  useEffect(() => {
    ;(async () => {
      try {
        setError('')
        await refreshSpaces()
        await refreshAdminData()
      } catch (err) {
        setError(err.message)
      }
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        await refreshSpaceData(selectedSpaceId)
      } catch (err) {
        setError(err.message)
      }
    })()
  }, [selectedSpaceId])

  const createSpace = async () => {
    try {
      setError('')
      await api.createSpace({ name: newSpaceName, description: newSpaceDesc })
      setNewSpaceName('')
      setNewSpaceDesc('')
      await refreshSpaces()
    } catch (err) {
      setError(err.message)
    }
  }

  const createRootProblem = async () => {
    try {
      setError('')
      await api.createRootProblem({
        type: problemType,
        title: problemTitle,
        statementMd: problemStatement,
        bodyJson: JSON.parse(problemBodyJson || '{}'),
        answerJson: JSON.parse(problemAnswerJson || '{}'),
        timeLimitMs: 1000,
        memoryLimitMiB: 256
      })
      setProblemTitle('')
      setProblemStatement('')
      await refreshAdminData()
    } catch (err) {
      setError(err.message)
    }
  }

  const linkProblem = async () => {
    try {
      if (!selectedSpaceId) return
      setError('')
      await api.addSpaceProblem(selectedSpaceId, Number(linkProblemId))
      setLinkProblemId('')
      await refreshSpaceData(selectedSpaceId)
    } catch (err) {
      setError(err.message)
    }
  }

  const createTrainingPlan = async () => {
    try {
      if (!selectedSpaceId) return
      setError('')
      await api.createTrainingPlan(selectedSpaceId, {
        title: planTitle,
        allowSelfJoin: true,
        published: true,
        chapters: [
          {
            title: 'Chapter 1',
            orderNo: 1,
            problemIds: spaceProblems.slice(0, 3).map((item) => item.id)
          }
        ]
      })
      setPlanTitle('')
      await refreshSpaceData(selectedSpaceId)
    } catch (err) {
      setError(err.message)
    }
  }

  const createHomework = async () => {
    try {
      if (!selectedSpaceId) return
      setError('')
      await api.createHomework(selectedSpaceId, {
        title: homeworkTitle,
        description: 'Auto-created homework',
        published: true,
        items: spaceProblems.slice(0, 3).map((item, index) => ({
          problemId: item.id,
          orderNo: index + 1,
          score: 100
        }))
      })
      setHomeworkTitle('')
      await refreshSpaceData(selectedSpaceId)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="page-shell">
      <header className="topbar">
        <div>
          <h1>OrangeOJ</h1>
          <p>{user.username} | {user.globalRole}</p>
        </div>
        <button className="danger" onClick={onLogout}>Logout</button>
      </header>

      {error && <div className="error-box">{error}</div>}

      <div className="grid-two">
        <aside className="panel">
          <h2>Spaces</h2>
          {spaces.map((space) => (
            <button
              key={space.id}
              className={`space-row ${space.id === selectedSpaceId ? 'active' : ''}`}
              onClick={() => setSelectedSpaceId(space.id)}
            >
              <strong>{space.name}</strong>
              <span>{space.description || 'No description'}</span>
            </button>
          ))}

          {user.globalRole === 'system_admin' && (
            <>
              <h3>Create Space</h3>
              <input
                placeholder="Space name"
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
              />
              <textarea
                placeholder="Space description"
                value={newSpaceDesc}
                onChange={(e) => setNewSpaceDesc(e.target.value)}
              />
              <button onClick={createSpace}>Create</button>
            </>
          )}
        </aside>

        <main className="panel">
          {selectedSpace ? (
            <>
              <h2>{selectedSpace.name}</h2>
              <div className="tabs">
                <button className={activeTab === 'problems' ? 'active' : ''} onClick={() => setActiveTab('problems')}>Problem Bank</button>
                <button className={activeTab === 'training' ? 'active' : ''} onClick={() => setActiveTab('training')}>Training Plans</button>
                <button className={activeTab === 'homework' ? 'active' : ''} onClick={() => setActiveTab('homework')}>Homework</button>
              </div>

              {activeTab === 'problems' && (
                <div className="tab-body">
                  <div className="inline-form">
                    <input
                      placeholder="Root problem ID"
                      value={linkProblemId}
                      onChange={(e) => setLinkProblemId(e.target.value)}
                    />
                    <button onClick={linkProblem}>Link</button>
                  </div>
                  {spaceProblems.map((problem) => (
                    <div className="list-item" key={problem.id}>
                      <div>
                        <strong>#{problem.id} {problem.title}</strong>
                        <p>{problem.type} | {problem.timeLimitMs}ms | {problem.memoryLimitMiB}MiB</p>
                      </div>
                      <Link to={`/spaces/${selectedSpaceId}/problems/${problem.id}/solve`} className="ghost-btn">Solve</Link>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'training' && (
                <div className="tab-body">
                  <div className="inline-form">
                    <input
                      placeholder="Plan title"
                      value={planTitle}
                      onChange={(e) => setPlanTitle(e.target.value)}
                    />
                    <button onClick={createTrainingPlan}>Create</button>
                  </div>
                  {trainingPlans.map((plan) => (
                    <div className="list-item" key={plan.id}>
                      <div>
                        <strong>{plan.title}</strong>
                        <p>{plan.allowSelfJoin ? 'Self join enabled' : 'Admin assign only'}</p>
                      </div>
                      <button onClick={() => api.joinTrainingPlan(selectedSpaceId, plan.id)}>Join</button>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'homework' && (
                <div className="tab-body">
                  <div className="inline-form">
                    <input
                      placeholder="Homework title"
                      value={homeworkTitle}
                      onChange={(e) => setHomeworkTitle(e.target.value)}
                    />
                    <button onClick={createHomework}>Create</button>
                  </div>
                  {homeworks.map((hw) => (
                    <div className="list-item" key={hw.id}>
                      <div>
                        <strong>{hw.title}</strong>
                        <p>{hw.published ? 'Published' : 'Draft'} {hw.dueAt ? `| Due ${hw.dueAt}` : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p>No spaces available.</p>
          )}
        </main>
      </div>

      {user.globalRole === 'system_admin' && (
        <section className="panel admin-panel">
          <h2>System Admin</h2>

          <div className="setting-row">
            <span>Registration</span>
            <button
              onClick={async () => {
                await api.setRegistration(!registrationEnabled)
                setRegistrationEnabled(!registrationEnabled)
              }}
            >
              {registrationEnabled ? 'Enabled (click to disable)' : 'Disabled (click to enable)'}
            </button>
          </div>

          <h3>Root Problem Bank</h3>
          <div className="problem-form">
            <select
              value={problemType}
              onChange={(e) => {
                const nextType = e.target.value
                setProblemType(nextType)
                setProblemBodyJson(asPretty(defaultBody(nextType)))
                setProblemAnswerJson(asPretty(defaultAnswer(nextType)))
              }}
            >
              <option value="programming">Programming</option>
              <option value="single_choice">Single Choice</option>
              <option value="true_false">True / False</option>
            </select>
            <input
              placeholder="Problem title"
              value={problemTitle}
              onChange={(e) => setProblemTitle(e.target.value)}
            />
            <textarea
              placeholder="Problem statement (Markdown)"
              value={problemStatement}
              onChange={(e) => setProblemStatement(e.target.value)}
            />
            <textarea
              className="mono"
              placeholder="bodyJson"
              value={problemBodyJson}
              onChange={(e) => setProblemBodyJson(e.target.value)}
            />
            <textarea
              className="mono"
              placeholder="answerJson"
              value={problemAnswerJson}
              onChange={(e) => setProblemAnswerJson(e.target.value)}
            />
            <button onClick={createRootProblem}>Create Root Problem</button>
          </div>

          <div className="root-list">
            {rootProblems.map((problem) => (
              <div className="list-item" key={problem.id}>
                <div>
                  <strong>#{problem.id} {problem.title}</strong>
                  <p>{problem.type} | {problem.timeLimitMs}ms | {problem.memoryLimitMiB}MiB</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}


