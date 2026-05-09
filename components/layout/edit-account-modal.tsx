'use client'

import { useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, KeyRound, UserCircle2, X } from 'lucide-react'

export type EditableAccountData = {
  name: string
  username: string
  phone: string
  photoBase64: string
  editUsername: boolean
  editPassword: boolean
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

type EditAccountModalProps = {
  open: boolean
  onClose: () => void
  initialData: EditableAccountData
  onSave: (data: EditableAccountData) => Promise<void> | void
  isSaving?: boolean
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível carregar a imagem'))
    }

    img.src = url
  })
}

async function fileToCompressedBase64(
  file: File,
  maxWidth = 512,
  maxHeight = 512,
  quality = 0.82
): Promise<string> {
  const image = await loadImage(file)

  let { width, height } = image
  const scale = Math.min(maxWidth / width, maxHeight / height, 1)

  width = Math.round(width * scale)
  height = Math.round(height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Não foi possível processar a imagem')
  }

  ctx.drawImage(image, 0, 0, width, height)

  return canvas.toDataURL('image/jpeg', quality)
}

function PasswordInput({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  const [show, setShow] = useState(false)

  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>

      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full h-10 rounded-lg border border-border bg-background px-3 pr-11 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        />

        <button
          type="button"
          onClick={() => setShow((prev) => !prev)}
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

export function EditAccountModal({
  open,
  onClose,
  initialData,
  onSave,
  isSaving = false,
}: EditAccountModalProps) {
  const [form, setForm] = useState<EditableAccountData>(initialData)
  const [imageError, setImageError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm(initialData)
      setImageError(null)
      setFormError(null)
    }
  }, [open, initialData])

  const previewSrc = useMemo(() => {
    return form.photoBase64?.trim() || ''
  }, [form.photoBase64])

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setImageError(null)

    if (!file.type.startsWith('image/')) {
      setImageError('Selecione um arquivo de imagem válido.')
      return
    }

    if (file.size > 8 * 1024 * 1024) {
      setImageError('A imagem original deve ter no máximo 8MB.')
      return
    }

    try {
      const base64 = await fileToCompressedBase64(file, 512, 512, 0.82)

      if (base64.length > 1_500_000) {
        setImageError('A imagem ainda ficou muito grande. Tente outra menor.')
        return
      }

      setForm((prev) => ({
        ...prev,
        photoBase64: base64,
      }))
    } catch {
      setImageError('Não foi possível carregar a imagem.')
    }
  }

  function handleToggleUsernameEdit() {
    setFormError(null)

    setForm((prev) => {
      if (prev.editUsername) {
        return {
          ...prev,
          editUsername: false,
          username: initialData.username,
          currentPassword: prev.editPassword ? prev.currentPassword : '',
        }
      }

      return {
        ...prev,
        editUsername: true,
      }
    })
  }

  function handleTogglePasswordEdit() {
    setFormError(null)

    setForm((prev) => {
      if (prev.editPassword) {
        return {
          ...prev,
          editPassword: false,
          newPassword: '',
          confirmPassword: '',
          currentPassword: prev.editUsername ? prev.currentPassword : '',
        }
      }

      return {
        ...prev,
        editPassword: true,
      }
    })
  }

  async function handleSubmit() {
    setFormError(null)

    const isEditingUsername = form.editUsername
    const isEditingPassword = form.editPassword

    if (isEditingUsername) {
      if (!form.username.trim()) {
        setFormError('Informe o nome de usuário.')
        return
      }
    }

    if (isEditingPassword) {
      if (!form.newPassword.trim()) {
        setFormError('Informe a nova senha.')
        return
      }

      if (form.newPassword.trim().length < 6) {
        setFormError('A nova senha deve ter pelo menos 6 caracteres.')
        return
      }

      if (form.newPassword !== form.confirmPassword) {
        setFormError('A confirmação da nova senha não confere.')
        return
      }
    }

    if (isEditingUsername || isEditingPassword) {
      if (!form.currentPassword.trim()) {
        setFormError('Informe a senha atual para confirmar a alteração.')
        return
      }

      if (isEditingPassword && form.currentPassword === form.newPassword) {
        setFormError('A nova senha deve ser diferente da senha atual.')
        return
      }
    }

    await onSave(form)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            Editar conta
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-4">
            {previewSrc ? (
              <img
                src={previewSrc}
                alt="Prévia da foto"
                className="h-16 w-16 rounded-full object-cover border border-border"
              />
            ) : (
              <div className="h-16 w-16 rounded-full border border-border bg-muted flex items-center justify-center text-sm text-muted-foreground">
                Sem foto
              </div>
            )}

            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">Foto</label>

              <input
                id="account-photo-input"
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />

              <div className="flex items-center gap-2">
                <label
                  htmlFor="account-photo-input"
                  className="inline-flex h-10 cursor-pointer items-center rounded-lg border border-border bg-background px-4 text-sm text-foreground hover:bg-accent transition-colors"
                >
                  Escolher arquivo
                </label>

                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      photoBase64: '',
                    }))
                  }
                  className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm hover:bg-accent transition-colors"
                >
                  Remover
                </button>
              </div>

              {imageError && (
                <p className="mt-2 text-xs text-red-600">{imageError}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Número</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, phone: e.target.value }))
              }
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm"
            />
          </div>

          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <UserCircle2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Usuário</p>
                  <p className="text-xs text-muted-foreground">
                    Para alterar o usuário, confirme com a senha atual.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleUsernameEdit}
                className={`h-9 px-4 rounded-lg text-sm transition-colors ${
                  form.editUsername
                    ? 'border border-red-500/30 text-red-600 hover:bg-red-500/10'
                    : 'border border-border hover:bg-accent'
                }`}
              >
                {form.editUsername ? 'Cancelar' : 'Editar usuário'}
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Usuário</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, username: e.target.value }))
                }
                disabled={!form.editUsername}
                className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Senha</p>
                  <p className="text-xs text-muted-foreground">
                    Para alterar a senha, confirme com a senha atual.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleTogglePasswordEdit}
                className={`h-9 px-4 rounded-lg text-sm transition-colors ${
                  form.editPassword
                    ? 'border border-red-500/30 text-red-600 hover:bg-red-500/10'
                    : 'border border-border hover:bg-accent'
                }`}
              >
                {form.editPassword ? 'Cancelar' : 'Editar senha'}
              </button>
            </div>

            <PasswordInput
              label="Nova senha"
              value={form.newPassword}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, newPassword: value }))
              }
              placeholder="Digite a nova senha"
              disabled={!form.editPassword}
            />

            <PasswordInput
              label="Confirmar nova senha"
              value={form.confirmPassword}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, confirmPassword: value }))
              }
              placeholder="Repita a nova senha"
              disabled={!form.editPassword}
            />
          </div>

          {(form.editUsername || form.editPassword) && (
            <div className="rounded-xl border border-border p-4 space-y-3">
              <PasswordInput
                label="Senha atual"
                value={form.currentPassword}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, currentPassword: value }))
                }
                placeholder="Digite sua senha atual para confirmar"
                disabled={false}
              />
            </div>
          )}

          {formError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">
              {formError}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-lg border border-border text-sm hover:bg-accent"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}