import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, toFriendlyError } from '../api'

function asPretty(value) {
  return JSON.stringify(value, null, 2)
}

function defaultBody(type) {
  if (type === 'programming') {
    return {
      inputFormat: '请在此填写输入格式',
      outputFormat: '请在此填写输出格式',
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

function problemTypeText(type) {
  if (type === 'programming') return '编程题'
  if (type === 'single_choice') return '单选题'
  if (type === 'true_false') return '判断题'
  return type
}

function parseBatchLines(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const normalized = line.replace(/，/g, ',')
      const commaIndex = normalized.indexOf(',')
      if (commaIndex < 0) {
        return { username: normalized.trim(), password: '' }
      }
      return {
        username: normalized.slice(0, commaIndex).trim(),
        password: normalized.slice(commaIndex + 1).trim()
      }
    })
}

function toBatchCopyText(batchResult) {
  if (!batchResult?.results?.length) return ''
  return batchResult.results.map((row) => {
    const username = row.username || '(空)'
    if (row.success) {
      return `第${row.index}行\t${username}\t成功\t用户ID: ${row.userId}`
    }
    return `第${row.index}行\t${username}\t失败\t原因: ${toFriendlyError(row.reason || '未知错误')}`
  }).join('\n')
}

export default function DashboardPage({ user, onLogout }) {
  const isSystemAdmin = user.globalRole === 'system_admin'
  const roleText = isSystemAdmin ? '系统管理员' : '普通用户'
  const [error, setError] = useState('')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef(null)

  const [spaces, setSpaces] = useState([])
  const [selectedSpaceId, setSelectedSpaceId] = useState(null)
  const [spaceTab, setSpaceTab] = useState('problems')
  const [adminTab, setAdminTab] = useState('space')

  const [rootProblems, setRootProblems] = useState([])
  const [registrationEnabled, setRegistrationEnabled] = useState(false)

  const [spaceProblems, setSpaceProblems] = useState([])
  const [trainingPlans, setTrainingPlans] = useState([])
  const [homeworks, setHomeworks] = useState([])

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
  const [memberUserId, setMemberUserId] = useState('')
  const [memberRole, setMemberRole] = useState('member')
  const [memberSubmitting, setMemberSubmitting] = useState(false)
  const [memberMessage, setMemberMessage] = useState('')

  const [batchInput, setBatchInput] = useState('')
  const [batchSpaceId, setBatchSpaceId] = useState('')
  const [batchSubmitting, setBatchSubmitting] = useState(false)
  const [batchResult, setBatchResult] = useState(null)

  const selectedSpace = useMemo(
    () => spaces.find((space) => space.id === selectedSpaceId) || null,
    [spaces, selectedSpaceId]
  )
  const isSpaceAdminOfSelectedSpace = Boolean(selectedSpace && selectedSpace.myRole === 'space_admin')
  const canManageSelectedSpace = isSystemAdmin || isSpaceAdminOfSelectedSpace

  const refreshSpaces = async () => {
    const list = await api.listSpaces()
    setSpaces(list)
    if (!selectedSpaceId && list.length > 0) {
      setSelectedSpaceId(list[0].id)
    }
    if (selectedSpaceId && !list.find((space) => space.id === selectedSpaceId)) {
      setSelectedSpaceId(list.length > 0 ? list[0].id : null)
    }
  }

  const refreshAdminData = async () => {
    if (!isSystemAdmin) return
    const [registration, problems] = await Promise.all([
      api.getRegistration(),
      api.listRootProblems()
    ])
    setRegistrationEnabled(Boolean(registration?.enabled))
    setRootProblems(problems || [])
  }

  const refreshSpaceData = async (spaceId) => {
    if (!spaceId) return
    const [problems, plans, hw] = await Promise.all([
      api.listSpaceProblems(spaceId),
      api.listTrainingPlans(spaceId),
      api.listHomeworks(spaceId)
    ])
    setSpaceProblems(problems || [])
    setTrainingPlans(plans || [])
    setHomeworks(hw || [])
  }

  useEffect(() => {
    ;(async () => {
      try {
        setError('')
        await refreshSpaces()
        await refreshAdminData()
      } catch (err) {
        setError(err.message || '加载失败')
      }
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        await refreshSpaceData(selectedSpaceId)
      } catch (err) {
        if (String(err?.message || '').includes('空间管理权限')) {
          setError('')
          return
        }
        setError(err.message || '加载空间数据失败')
      }
    })()
  }, [selectedSpaceId])

  useEffect(() => {
    setMemberMessage('')
    setMemberUserId('')
    setMemberRole('member')
    if (spaceTab === 'members' && !canManageSelectedSpace) {
      setSpaceTab('problems')
    }
  }, [selectedSpaceId, canManageSelectedSpace])

  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (!userMenuRef.current) return
      if (!userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false)
      }
    }
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleDocumentClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [])

  const createSpace = async () => {
    if (!newSpaceName.trim()) {
      setError('空间名称不能为空')
      return
    }
    try {
      setError('')
      await api.createSpace({ name: newSpaceName.trim(), description: newSpaceDesc.trim() })
      setNewSpaceName('')
      setNewSpaceDesc('')
      await refreshSpaces()
    } catch (err) {
      setError(err.message)
    }
  }

  const ensureCanManageSpace = () => {
    if (canManageSelectedSpace) return true
    setError('当前账号为普通成员，无空间管理权限')
    return false
  }

  const createRootProblem = async () => {
    if (!problemTitle.trim()) {
      setError('题目标题不能为空')
      return
    }
    try {
      setError('')
      await api.createRootProblem({
        type: problemType,
        title: problemTitle.trim(),
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
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    if (!linkProblemId.trim()) {
      setError('请输入根题库题目 ID')
      return
    }
    try {
      setError('')
      await api.addSpaceProblem(selectedSpaceId, Number(linkProblemId))
      setLinkProblemId('')
      await refreshSpaceData(selectedSpaceId)
    } catch (err) {
      setError(err.message)
    }
  }

  const createTrainingPlan = async () => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    if (!planTitle.trim()) {
      setError('训练计划标题不能为空')
      return
    }
    try {
      setError('')
      await api.createTrainingPlan(selectedSpaceId, {
        title: planTitle.trim(),
        allowSelfJoin: true,
        published: true,
        chapters: [
          {
            title: '第一章',
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

  const joinTrainingPlan = async (planId) => {
    if (!selectedSpaceId) return
    try {
      setError('')
      await api.joinTrainingPlan(selectedSpaceId, planId)
      await refreshSpaceData(selectedSpaceId)
    } catch (err) {
      setError(err.message)
    }
  }

  const createHomework = async () => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    if (!homeworkTitle.trim()) {
      setError('作业标题不能为空')
      return
    }
    try {
      setError('')
      await api.createHomework(selectedSpaceId, {
        title: homeworkTitle.trim(),
        description: '系统自动生成作业',
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

  const handleAddMember = async () => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    const userId = Number(memberUserId)
    if (!Number.isInteger(userId) || userId <= 0) {
      setError('请输入有效的用户ID')
      return
    }
    if (memberRole !== 'member' && memberRole !== 'space_admin') {
      setError('请选择有效角色')
      return
    }

    try {
      setError('')
      setMemberMessage('')
      setMemberSubmitting(true)
      await api.addSpaceMember(selectedSpaceId, userId, memberRole)
      setMemberUserId('')
      setMemberMessage(`用户 #${userId} 已加入空间，角色：${memberRole === 'space_admin' ? '空间管理员' : '成员'}`)
      await refreshSpaces()
    } catch (err) {
      setError(err.message)
    } finally {
      setMemberSubmitting(false)
    }
  }

  const toggleRegistration = async () => {
    try {
      setError('')
      const next = !registrationEnabled
      await api.setRegistration(next)
      setRegistrationEnabled(next)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleBatchRegister = async () => {
    const items = parseBatchLines(batchInput)
    if (items.length === 0) {
      setError('请输入批量账号，格式为每行：用户名,密码')
      return
    }

    const payload = { items }
    if (batchSpaceId) {
      payload.spaceId = Number(batchSpaceId)
    }

    try {
      setError('')
      setBatchSubmitting(true)
      const result = await api.batchRegisterUsers(payload)
      setBatchResult(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setBatchSubmitting(false)
    }
  }

  const copyBatchResult = async () => {
    const text = toBatchCopyText(batchResult)
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setError('')
    } catch {
      setError('复制失败，请手动复制结果内容')
    }
  }

  const renderTopbarSpaceSwitcher = () => (
    <div className="topbar-space">
      <label className="space-switcher">
        <span>空间</span>
        <select
          value={selectedSpaceId ? String(selectedSpaceId) : ''}
          onChange={(event) => setSelectedSpaceId(event.target.value ? Number(event.target.value) : null)}
          disabled={spaces.length === 0}
        >
          {spaces.length === 0 ? (
            <option value="">暂无空间</option>
          ) : (
            spaces.map((space) => (
              <option key={space.id} value={String(space.id)}>{space.name}</option>
            ))
          )}
        </select>
      </label>
    </div>
  )

  const renderSpacesSection = () => (
    <div className="space-content-grid">
      {isSystemAdmin && (
        <section className="panel">
          <h2>创建空间</h2>
          <div className="space-create-form">
            <input
              placeholder="空间名称"
              value={newSpaceName}
              onChange={(event) => setNewSpaceName(event.target.value)}
            />
            <textarea
              placeholder="空间描述"
              value={newSpaceDesc}
              onChange={(event) => setNewSpaceDesc(event.target.value)}
            />
            <button onClick={createSpace}>创建空间</button>
          </div>
        </section>
      )}

      <main className="panel">
        {!selectedSpace ? (
          <p className="muted">{spaces.length === 0 ? '暂无可访问空间，请先创建或加入空间。' : '请选择一个空间。'}</p>
        ) : (
          <>
            <div className="tabs">
              <button className={spaceTab === 'problems' ? 'active' : ''} onClick={() => setSpaceTab('problems')}>题库</button>
              <button className={spaceTab === 'training' ? 'active' : ''} onClick={() => setSpaceTab('training')}>训练计划</button>
              <button className={spaceTab === 'homework' ? 'active' : ''} onClick={() => setSpaceTab('homework')}>作业</button>
              {canManageSelectedSpace && (
                <button className={spaceTab === 'members' ? 'active' : ''} onClick={() => setSpaceTab('members')}>成员管理</button>
              )}
            </div>

            {spaceTab === 'problems' && (
              <div className="tab-body">
                {canManageSelectedSpace && (
                  <div className="inline-form">
                    <input
                      placeholder="根题库题目 ID"
                      value={linkProblemId}
                      onChange={(event) => setLinkProblemId(event.target.value)}
                    />
                    <button onClick={linkProblem}>添加到空间</button>
                  </div>
                )}
                {spaceProblems.length === 0 && <p className="muted">当前空间暂无题目。</p>}
                {spaceProblems.map((problem) => (
                  <div className="list-item" key={problem.id}>
                    <div>
                      <strong>#{problem.id} {problem.title}</strong>
                      <p>{problemTypeText(problem.type)} | {problem.timeLimitMs}ms | {problem.memoryLimitMiB}MiB</p>
                    </div>
                    <Link to={`/spaces/${selectedSpaceId}/problems/${problem.id}/solve`} className="ghost-btn">去做题</Link>
                  </div>
                ))}
              </div>
            )}

            {spaceTab === 'training' && (
              <div className="tab-body">
                {canManageSelectedSpace && (
                  <div className="inline-form">
                    <input
                      placeholder="训练计划标题"
                      value={planTitle}
                      onChange={(event) => setPlanTitle(event.target.value)}
                    />
                    <button onClick={createTrainingPlan}>创建训练计划</button>
                  </div>
                )}
                {trainingPlans.length === 0 && <p className="muted">暂无训练计划。</p>}
                {trainingPlans.map((plan) => (
                  <div className="list-item" key={plan.id}>
                    <div>
                      <strong>{plan.title}</strong>
                      <p>{plan.allowSelfJoin ? '允许主动参加' : '仅管理员分配'}</p>
                    </div>
                    <button onClick={() => joinTrainingPlan(plan.id)}>参加</button>
                  </div>
                ))}
              </div>
            )}

            {spaceTab === 'homework' && (
              <div className="tab-body">
                {canManageSelectedSpace && (
                  <div className="inline-form">
                    <input
                      placeholder="作业标题"
                      value={homeworkTitle}
                      onChange={(event) => setHomeworkTitle(event.target.value)}
                    />
                    <button onClick={createHomework}>创建作业</button>
                  </div>
                )}
                {homeworks.length === 0 && <p className="muted">暂无作业。</p>}
                {homeworks.map((hw) => (
                  <div className="list-item" key={hw.id}>
                    <div>
                      <strong>{hw.title}</strong>
                      <p>{hw.published ? '已发布' : '草稿'} {hw.dueAt ? `| 截止：${hw.dueAt}` : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {spaceTab === 'members' && (
              <div className="tab-body">
                <p className="muted">将已注册用户加入当前空间。请输入用户 ID，可设置为成员或空间管理员。</p>
                <div className="inline-form">
                  <input
                    type="number"
                    min="1"
                    placeholder="用户ID，例如 2"
                    value={memberUserId}
                    onChange={(event) => setMemberUserId(event.target.value)}
                  />
                  <select className="member-role-select" value={memberRole} onChange={(event) => setMemberRole(event.target.value)}>
                    <option value="member">成员</option>
                    <option value="space_admin">空间管理员</option>
                  </select>
                  <button disabled={memberSubmitting} onClick={handleAddMember}>
                    {memberSubmitting ? '添加中...' : '添加成员'}
                  </button>
                </div>
                {memberMessage && <div className="ok-box">{memberMessage}</div>}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )

  const renderRootProblemSection = () => (
    <section className="panel">
      <h2>根题库管理</h2>
      <div className="problem-form">
        <select
          value={problemType}
          onChange={(event) => {
            const nextType = event.target.value
            setProblemType(nextType)
            setProblemBodyJson(asPretty(defaultBody(nextType)))
            setProblemAnswerJson(asPretty(defaultAnswer(nextType)))
          }}
        >
          <option value="programming">编程题</option>
          <option value="single_choice">单选题</option>
          <option value="true_false">判断题</option>
        </select>
        <input
          placeholder="题目标题"
          value={problemTitle}
          onChange={(event) => setProblemTitle(event.target.value)}
        />
        <textarea
          placeholder="题面（Markdown）"
          value={problemStatement}
          onChange={(event) => setProblemStatement(event.target.value)}
        />
        <textarea
          className="mono"
          placeholder="bodyJson"
          value={problemBodyJson}
          onChange={(event) => setProblemBodyJson(event.target.value)}
        />
        <textarea
          className="mono"
          placeholder="answerJson"
          value={problemAnswerJson}
          onChange={(event) => setProblemAnswerJson(event.target.value)}
        />
        <button onClick={createRootProblem}>创建题目</button>
      </div>

      <div className="root-list">
        {rootProblems.length === 0 && <p className="muted">根题库暂无题目。</p>}
        {rootProblems.map((problem) => (
          <div className="list-item" key={problem.id}>
            <div>
              <strong>#{problem.id} {problem.title}</strong>
              <p>{problemTypeText(problem.type)} | {problem.timeLimitMs}ms | {problem.memoryLimitMiB}MiB</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )

  const renderSystemSection = () => (
    <div className="system-grid">
      <section className="panel">
        <h2>系统设置</h2>
        <div className="setting-row">
          <span>注册开关</span>
          <button onClick={toggleRegistration}>
            {registrationEnabled ? '已开启（点击关闭）' : '已关闭（点击开启）'}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>批量注册用户</h2>
        <p className="muted">每行一个账号，格式：<code>用户名,密码</code>，密码至少 6 位。</p>
        <textarea
          className="mono batch-input"
          value={batchInput}
          onChange={(event) => setBatchInput(event.target.value)}
          placeholder={'student01,123456\nstudent02,123456'}
        />
        <div className="inline-form">
          <label className="inline-field">
            加入空间（可选）
            <select value={batchSpaceId} onChange={(event) => setBatchSpaceId(event.target.value)}>
              <option value="">不加入空间</option>
              {spaces.map((space) => (
                <option key={space.id} value={String(space.id)}>{space.name}</option>
              ))}
            </select>
          </label>
          <button disabled={batchSubmitting} onClick={handleBatchRegister}>
            {batchSubmitting ? '处理中...' : '开始批量注册'}
          </button>
        </div>

        {batchResult && (
          <div className="batch-result-wrap">
            <div className="result-head">
              <strong>
                总计 {batchResult.total} 条，成功 {batchResult.successCount} 条，失败 {batchResult.failureCount} 条
              </strong>
              <button className="ghost-btn" onClick={copyBatchResult}>复制结果</button>
            </div>
            <table className="result-table">
              <thead>
                <tr>
                  <th>行号</th>
                  <th>用户名</th>
                  <th>结果</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                {batchResult.results.map((row) => (
                  <tr key={row.index}>
                    <td>{row.index}</td>
                    <td>{row.username || '(空)'}</td>
                    <td>{row.success ? '成功' : '失败'}</td>
                    <td>{row.success ? `用户ID: ${row.userId}` : toFriendlyError(row.reason || '未知错误')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )

  return (
    <div className="page-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <h1>OrangeOJ</h1>
          <p>欢迎回来，开始今天的学习与管理</p>
        </div>
        {renderTopbarSpaceSwitcher()}
        <div className="header-actions" ref={userMenuRef}>
          <button
            className={`user-menu-trigger ${userMenuOpen ? 'open' : ''}`}
            aria-haspopup="menu"
            aria-expanded={userMenuOpen}
            onClick={() => setUserMenuOpen((prev) => !prev)}
          >
            <span className="user-menu-text">
              <strong>{user.username}</strong>
              <small>{roleText}</small>
            </span>
            <span className="user-menu-caret">{userMenuOpen ? '▴' : '▾'}</span>
          </button>
          {userMenuOpen && (
            <div className="user-menu-panel" role="menu">
              <div className="user-menu-meta">{user.username} · {roleText}</div>
              <button
                className="user-menu-item danger"
                onClick={() => {
                  setUserMenuOpen(false)
                  onLogout()
                }}
              >
                退出登录
              </button>
            </div>
          )}
        </div>
      </header>

      {error && <div className="error-box">{error}</div>}

      {isSystemAdmin && (
        <div className="tabs main-tabs">
          <button className={adminTab === 'space' ? 'active' : ''} onClick={() => setAdminTab('space')}>空间管理</button>
          <button className={adminTab === 'root' ? 'active' : ''} onClick={() => setAdminTab('root')}>根题库管理</button>
          <button className={adminTab === 'system' ? 'active' : ''} onClick={() => setAdminTab('system')}>系统设置</button>
        </div>
      )}

      {!isSystemAdmin && renderSpacesSection()}
      {isSystemAdmin && adminTab === 'space' && renderSpacesSection()}
      {isSystemAdmin && adminTab === 'root' && renderRootProblemSection()}
      {isSystemAdmin && adminTab === 'system' && renderSystemSection()}
    </div>
  )
}
