import { useState } from 'react'
import { Button } from '../ui/button'
import { Card, CardContent } from '../ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { Copy, Trash2 } from 'lucide-react'
import ToastMessage from '../ToastMessage'

export default function SystemPanel({
  systemTab, onSystemTabChange, registrationEnabled, onToggleRegistration,
  adminResetMessage, onOpenAdminResetDialog, batchResult, onOpenBatchRegisterDialog,
  onCopyBatchResult, toFriendlyError, onCleanupOrphanedImages
}) {
  const [cleanupResult, setCleanupResult] = useState(null)
  const [cleanupError, setCleanupError] = useState('')
  const [cleaningUp, setCleaningUp] = useState(false)

  const handleCleanup = async () => {
    setCleaningUp(true); setCleanupError(''); setCleanupResult(null)
    try {
      const result = await onCleanupOrphanedImages()
      setCleanupResult(result)
    } catch (err) {
      setCleanupError(err.message || '清理失败')
    } finally {
      setCleaningUp(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
      <Tabs value={systemTab} onValueChange={onSystemTabChange}>
        <TabsList className="mb-6">
          <TabsTrigger value="settings">系统设置</TabsTrigger>
          <TabsTrigger value="account">账号维护</TabsTrigger>
          <TabsTrigger value="batch">批量注册</TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <h2 className="text-lg font-semibold mb-4">系统设置</h2>
          <div className="flex justify-between items-center py-3">
            <span>注册开关</span>
            <Button variant={registrationEnabled ? 'default' : 'outline'} onClick={onToggleRegistration}>
              {registrationEnabled ? '已开启（点击关闭）' : '已关闭（点击开启）'}
            </Button>
          </div>
          <div className="flex justify-between items-center py-3 border-t">
            <div>
              <span>清理孤立图片</span>
              <p className="text-xs text-muted-foreground mt-0.5">扫描 uploads 目录，删除未被任何题目或标签引用的图片</p>
            </div>
            <Button variant="outline" onClick={handleCleanup} disabled={cleaningUp}>
              <Trash2 className="h-4 w-4 mr-1" />
              {cleaningUp ? '清理中...' : '开始清理'}
            </Button>
          </div>
          {cleanupError && <ToastMessage message={cleanupError} severity="error" onShown={() => setCleanupError('')} />}
          {cleanupResult && (
            <ToastMessage
              message={`已清理 ${cleanupResult.deleted} 张孤立图片`}
              severity={cleanupResult.deleted > 0 ? 'success' : 'info'}
              onShown={() => setCleanupResult(null)}
            />
          )}
        </TabsContent>

        <TabsContent value="account">
          <h2 className="text-lg font-semibold mb-2">重置用户密码</h2>
          <p className="text-sm text-muted-foreground mb-4">
            系统管理员可将任意用户密码重置为 123456。
          </p>
          <Button onClick={onOpenAdminResetDialog}>打开重置弹窗</Button>
        </TabsContent>

        <TabsContent value="batch">
          <h2 className="text-lg font-semibold mb-2">批量注册用户</h2>
          <p className="text-sm text-muted-foreground mb-4">
            通过弹窗录入批量账号，提交后结果会展示在下方。
          </p>
          <Button onClick={onOpenBatchRegisterDialog}>打开批量注册弹窗</Button>

          {batchResult && (
            <div className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-medium">
                  总计 {batchResult.total}条，成功{batchResult.successCount}条，失败{batchResult.failureCount}条
                </span>
                <Button size="sm" variant="ghost" onClick={onCopyBatchResult}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>行号</TableHead>
                    <TableHead>用户名</TableHead>
                    <TableHead>结果</TableHead>
                    <TableHead>说明</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchResult.results.map((row) => (
                    <TableRow key={row.index}>
                      <TableCell>{row.index}</TableCell>
                      <TableCell>{row.username || '(空)'}</TableCell>
                      <TableCell>
                        <span className={row.success ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                          {row.success ? '成功' : '失败'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {row.success ? `用户 ID: ${row.userId}` : toFriendlyError(row.reason || '未知错误')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
      </CardContent>
    </Card>
  )
}
