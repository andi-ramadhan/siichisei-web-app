import { AlertTriangle, CheckCircle, Info, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "destructive", // destructive, success, default
  isLoading = false,
  showCancel = true
}) {
  if (!isOpen) return null

  const getIcon = () => {
    switch (variant) {
      case 'destructive':
        return <AlertTriangle className="h-6 w-6" />
      case 'success':
        return <CheckCircle className="h-6 w-6" />
      default:
        return <Info className="h-6 w-6" />
    }
  }

  const getIconBg = () => {
    switch (variant) {
      case 'destructive':
        return 'bg-red-100 text-red-600 dark:bg-red-900/20'
      case 'success':
        return 'bg-green-100 text-green-600 dark:bg-green-900/20'
      default:
        return 'bg-primary/10 text-primary'
    }
  }

  const getConfirmButtonVariant = () => {
    switch (variant) {
      case 'destructive': return 'destructive'
      case 'success': return 'default' // or specific success style if available
      default: return 'default'
    }
  }

  const getConfirmButtonClass = () => {
    switch (variant) {
      case 'destructive': return 'bg-red-600 hover:bg-red-700'
      case 'success': return 'bg-green-600 hover:bg-green-700 text-white'
      default: return ''
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      <Card className="w-full max-w-md shadow-lg scale-100 animate-in zoom-in-95 duration-200 border-none sm:border bg-background">
        <CardHeader className="space-y-3 relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 h-6 w-6 rounded-full opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>

          <div className={`flex items-center justify-center w-12 h-12 rounded-full mx-auto ${getIconBg()}`}>
            {getIcon()}
          </div>
          <CardTitle className="text-center text-xl">{title}</CardTitle>
          <CardDescription className="text-center text-base">
            {description}
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col sm:flex-row gap-3 w-full sm:justify-end">
          {showCancel && (
            <Button
              variant="outline"
              onClick={onClose}
              className="w-full sm:w-auto mt-2 sm:mt-0 order-2 sm:order-1"
              disabled={isLoading}
            >
              {cancelText}
            </Button>
          )}
          <Button
            variant={getConfirmButtonVariant()}
            onClick={onConfirm || onClose}
            className={`w-full sm:w-auto order-1 sm:order-2 ${getConfirmButtonClass()}`}
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : confirmText}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
