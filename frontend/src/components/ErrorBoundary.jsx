import { Component } from 'react'
import { Button } from './ui/button'
import { Alert, AlertTitle, AlertDescription } from './ui/alert'
import { AlertCircle } from 'lucide-react'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    console.error('ErrorBoundary caught error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
          <Alert variant="destructive" className="max-w-xl w-full">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>出错了</AlertTitle>
            <AlertDescription>{this.state.error?.toString()}</AlertDescription>
          </Alert>
          <Button onClick={this.handleReset}>返回首页</Button>
        </div>
      )
    }
    return this.props.children
  }
}

export { ErrorBoundary }
