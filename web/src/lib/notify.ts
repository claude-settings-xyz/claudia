import { toast } from '@/components/ui/toast'

export const notify = {
  success: (title: string, description?: string) =>
    toast.add({ title, description, type: 'success' }),
  error: (title: string, description?: string) =>
    toast.add({ title, description, type: 'error', timeout: 8000 }),
}
