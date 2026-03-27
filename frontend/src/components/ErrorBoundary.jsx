import React, { Component } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
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
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            gap: 3,
            p: 3
          }}
        >
          <Alert severity="error" sx={{ maxWidth: 600, width: '100%' }}>
            <Typography variant="h6" gutterBottom>
              出错了
            </Typography>
            <Typography variant="body2" paragraph>
              {this.state.error?.toString()}
            </Typography>
          </Alert>
          <Button variant="contained" onClick={this.handleReset}>
            返回首页
          </Button>
        </Box>
      )
    }

    return this.props.children
  }
}

export { ErrorBoundary }
