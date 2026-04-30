import { useCallback, useState } from 'react'

export default function useDashboardSearchState() {
  const [spaceProblemSearch, setSpaceProblemSearch] = useState('')
  const [learningProblemSearch, setLearningProblemSearch] = useState('')
  const [learningTrainingSearch, setLearningTrainingSearch] = useState('')
  const [learningHomeworkSearch, setLearningHomeworkSearch] = useState('')

  const resetSearchState = useCallback(() => {
    setSpaceProblemSearch('')
    setLearningProblemSearch('')
    setLearningTrainingSearch('')
    setLearningHomeworkSearch('')
  }, [])

  return {
    spaceProblemSearch,
    setSpaceProblemSearch,
    learningProblemSearch,
    setLearningProblemSearch,
    learningTrainingSearch,
    setLearningTrainingSearch,
    learningHomeworkSearch,
    setLearningHomeworkSearch,
    resetSearchState
  }
}
