import { AlertTriangle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "destructive",
  isLoading = false
}) {
  if (!isOpen) return null

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

          <div className={`flex items-center justify-center w-12 h-12 rounded-full mx-auto ${variant === 'destructive' ? 'bg-red-100 text-red-600 dark:bg-red-900/20' : 'bg-primary/10 text-primary'
            }`}>
            <AlertTriangle className="h-6 w-6" />
          </div>
          <CardTitle className="text-center text-xl">{title}</CardTitle> // Increased text size
          <CardDescription className="text-center text-base">
            {description}
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col sm:flex-row gap-3 w-full sm:justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto mt-2 sm:mt-0 order-2 sm:order-1"
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            variant={variant}
            onClick={onConfirm}
            className={`w-full sm:w-auto order-1 sm:order-2 ${variant === 'destructive' ? 'bg-red-600 hover:bg-red-700' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : confirmText}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
