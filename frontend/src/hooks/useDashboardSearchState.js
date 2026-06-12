import { useCallback, useState } from 'react'

export default function useDashboardSearchState() {
  const [spaceProblemSearch, setSpaceProblemSearch] = useState('')
  const [learningProblemSearch, setLearningProblemSearch] = useState('')
  const [learningTrainingSearch, setLearningTrainingSearch] = useState('')
  const [learningPracticeSearch, setLearningPracticeSearch] = useState('')

  const resetSearchState = useCallback(() => {
    setSpaceProblemSearch('')
    setLearningProblemSearch('')
    setLearningTrainingSearch('')
    setLearningPracticeSearch('')
  }, [])

  return {
    spaceProblemSearch,
    setSpaceProblemSearch,
    learningProblemSearch,
    setLearningProblemSearch,
    learningTrainingSearch,
    setLearningTrainingSearch,
    learningPracticeSearch,
    setLearningPracticeSearch,
    resetSearchState
  }
}
