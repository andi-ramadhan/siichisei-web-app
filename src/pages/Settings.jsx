import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Loader2, LogOut, Save, Pencil, X } from 'lucide-react'
import { ConfirmationModal } from '@/components/ui/ConfirmationModal'

export default function Settings() {
  const { session } = useAuth()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  // Profile state
  const [fullName, setFullName] = useState('')
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')

  // Store original data for reverting changes
  const [originalData, setOriginalData] = useState({ full_name: '', nickname: '' })

  useEffect(() => {
    if (session?.user) {
      getProfile()
      setEmail(session.user.email)
    }
  }, [session])

  async function getProfile() {
    try {
      setLoading(true)
      const { user } = session

      const { data, error } = await supabase
        .from('profile')
        .select('full_name, nickname')
        .eq('id', user.id)
        .single()

      if (error) {
        throw error
      }

      if (data) {
        setFullName(data.full_name || '')
        setNickname(data.nickname || '')
        setOriginalData({
          full_name: data.full_name || '',
          nickname: data.nickname || ''
        })
      }
    } catch (error) {
      console.warn('Error fetching profile:', error.message)
    } finally {
      setLoading(false)
    }
  }

  async function updateProfile() {
    try {
      setSaving(true)
      const { user } = session

      const updates = {
        id: user.id,
        full_name: fullName,
        nickname: nickname,
      }

      const { error } = await supabase
        .from('profile')
        .upsert(updates)

      if (error) throw error

      setOriginalData({ full_name: fullName, nickname: nickname })
      setIsEditing(false)
      alert('Profile updated successfully!')
    } catch (error) {
      alert('Error updating profile: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  function handleCancelEdit() {
    setFullName(originalData.full_name)
    setNickname(originalData.nickname)
    setIsEditing(false)
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut()
    if (error) alert('Error signing out!')
  }

  return (
    <div className="container mx-auto max-w-2xl py-10 px-4 space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Manage your account settings and profile.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="space-y-1">
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              Update your personal information.
            </CardDescription>
          </div>
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={email}
              disabled
              className="bg-muted text-muted-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullname">Full Name</Label>
            <Input
              id="fullname"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
              disabled={!isEditing}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nickname">Nickname</Label>
            <Input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Enter your nickname"
              disabled={!isEditing}
            />
          </div>
        </CardContent>
        {isEditing && (
          <CardFooter className="flex justify-between border-t pt-6">
            <Button variant="ghost" onClick={handleCancelEdit}>
              Cancel
            </Button>
            <Button onClick={updateProfile} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardFooter>
        )}
      </Card>

      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Actions that affect your session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => setShowLogoutModal(true)}
            className="w-full sm:w-auto bg-red-600 hover:bg-red-700"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </CardContent>
      </Card>

      <ConfirmationModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
        title="Confirm Logout"
        description="Are you sure you want to end your session? You will need to login again to access your dashboard."
        confirmText="Logout"
        variant="destructive"
      />
    </div>
  )
}
