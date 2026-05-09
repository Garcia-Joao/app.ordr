'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import {
  createAccessRole,
  createAccessUser,
  deleteAccessRole,
  getAccessRoles,
  getAccessUsers,
  getAccessEventDates,
  getPermissionCatalog,
  updateAccessRole,
  updateAccessUser,
  type AccessRole,
  type AccessUser,
  type PermissionCatalogGroup,
} from '@/lib/api/access'
import { canAny, getStoredUser } from '@/lib/permissions'
import type { AuthUser } from '@/lib/api/auth'
import type { EventDate } from '@/lib/api/events'

type RoleForm = {
  id?: string
  name: string
  description: string
  active: boolean
  permissionKeys: string[]
}

type UserForm = {
  id?: string
  name: string
  username: string
  phone: string
  password: string
  systemRole: 'ADMIN' | 'CUSTOM'
  customRoleId: string
  activeEventDateId: string
}

const emptyRoleForm: RoleForm = {
  name: '',
  description: '',
  active: true,
  permissionKeys: [],
}

const emptyUserForm: UserForm = {
  name: '',
  username: '',
  phone: '',
  password: '',
  systemRole: 'CUSTOM',
  customRoleId: '',
  activeEventDateId: '',
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase()
}

function rolePermissionKeys(role: AccessRole | null | undefined) {
  return role?.permissions?.map((permission) => permission.permissionKey) ?? []
}


function formatEventDateLabel(eventDate: EventDate) {
  const start = new Date(eventDate.startAt)
  const date = start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const time = start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${eventDate.title} • ${date} ${time}`
}

function permissionCountLabel(count: number) {
  return count === 1 ? '1 permissão' : `${count} permissões`
}

function Modal({
  open,
  title,
  description,
  icon,
  children,
  footer,
  onClose,
  maxWidth = 'max-w-4xl',
}: {
  open: boolean
  title: string
  description?: string
  icon?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  onClose: () => void
  maxWidth?: string
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className={`flex max-h-[96vh] w-full ${maxWidth} flex-col overflow-hidden rounded-t-3xl border bg-card shadow-2xl sm:max-h-[92vh] sm:rounded-3xl`}>
        <div className="flex items-start justify-between gap-3 border-b p-4 sm:p-5">
          <div className="flex min-w-0 items-start gap-3">
            {icon && (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-xl font-black tracking-tight">{title}</h2>
              {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-5">{children}</div>

        {footer && <div className="flex flex-col-reverse gap-2 border-t bg-muted/30 p-4 sm:flex-row sm:flex-wrap sm:justify-end">{footer}</div>}
      </div>
    </div>
  )
}

export default function AcessosPage() {
  const [permissionGroups, setPermissionGroups] = useState<PermissionCatalogGroup[]>([])
  const [roles, setRoles] = useState<AccessRole[]>([])
  const [users, setUsers] = useState<AccessUser[]>([])
  const [eventDates, setEventDates] = useState<EventDate[]>([])
  const [roleForm, setRoleForm] = useState<RoleForm>(emptyRoleForm)
  const [userForm, setUserForm] = useState<UserForm>(emptyUserForm)
  const [permissionSearch, setPermissionSearch] = useState('')
  const [roleSearch, setRoleSearch] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingRole, setIsSavingRole] = useState(false)
  const [isSavingUser, setIsSavingUser] = useState(false)
  const [isDeletingRoleId, setIsDeletingRoleId] = useState<string | null>(null)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)

  const canManageRoles = canAny(authUser, ['roles.manage'])
  const canManageUsers = canAny(authUser, ['users.manage'])
  const canManageAccess = canManageRoles || canManageUsers

  const totalPermissions = useMemo(
    () => permissionGroups.reduce((sum, group) => sum + group.permissions.length, 0),
    [permissionGroups]
  )

  const activeRoles = useMemo(() => roles.filter((role) => role.active), [roles])

  const filteredRoles = useMemo(() => {
    const search = normalizeSearch(roleSearch)
    if (!search) return roles

    return roles.filter((role) => {
      return (
        role.name.toLowerCase().includes(search) ||
        (role.description ?? '').toLowerCase().includes(search) ||
        rolePermissionKeys(role).some((permission) => permission.toLowerCase().includes(search))
      )
    })
  }, [roles, roleSearch])

  const filteredUsers = useMemo(() => {
    const search = normalizeSearch(userSearch)
    if (!search) return users

    return users.filter((membership) => {
      return (
        membership.user.username.toLowerCase().includes(search) ||
        (membership.user.name ?? '').toLowerCase().includes(search) ||
        (membership.user.phone ?? '').toLowerCase().includes(search) ||
        (membership.customRole?.name ?? '').toLowerCase().includes(search)
      )
    })
  }, [users, userSearch])

  const filteredPermissionGroups = useMemo(() => {
    const search = normalizeSearch(permissionSearch)
    if (!search) return permissionGroups

    return permissionGroups
      .map((group) => ({
        ...group,
        permissions: group.permissions.filter((permission) => {
          return (
            permission.label.toLowerCase().includes(search) ||
            permission.key.toLowerCase().includes(search) ||
            group.group.toLowerCase().includes(search)
          )
        }),
      }))
      .filter((group) => group.permissions.length > 0)
  }, [permissionGroups, permissionSearch])

  const selectedPermissions = useMemo(() => new Set(roleForm.permissionKeys), [roleForm.permissionKeys])

  async function loadData() {
    try {
      setIsLoading(true)
      const [catalogResult, rolesResult, usersResult, eventDatesResult] = await Promise.all([
        getPermissionCatalog(),
        getAccessRoles(),
        getAccessUsers(),
        getAccessEventDates().catch(() => ({ eventDates: [] })),
      ])
      setPermissionGroups(catalogResult.groups)
      setRoles(rolesResult.roles)
      setUsers(usersResult.users)
      setEventDates(eventDatesResult.eventDates)
    } catch (error: any) {
      console.error('Erro ao carregar acessos:', error)
      alert(error?.message || 'Erro ao carregar acessos')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    setAuthUser(getStoredUser())

    function handleUserUpdated() {
      setAuthUser(getStoredUser())
    }

    window.addEventListener('storage', handleUserUpdated)
    window.addEventListener('ordr-user-updated', handleUserUpdated)

    loadData()

    return () => {
      window.removeEventListener('storage', handleUserUpdated)
      window.removeEventListener('ordr-user-updated', handleUserUpdated)
    }
  }, [])

  function openNewRoleModal() {
    if (!canManageRoles) return
    setRoleForm(emptyRoleForm)
    setPermissionSearch('')
    setIsRoleModalOpen(true)
  }

  function openEditRoleModal(role: AccessRole) {
    if (!canManageRoles) return
    setRoleForm({
      id: role.id,
      name: role.name,
      description: role.description ?? '',
      active: role.active,
      permissionKeys: rolePermissionKeys(role),
    })
    setPermissionSearch('')
    setIsRoleModalOpen(true)
  }

  function openNewUserModal() {
    if (!canManageUsers) return
    setUserForm(emptyUserForm)
    setShowPassword(false)
    setIsUserModalOpen(true)
  }

  function openEditUserModal(membership: AccessUser) {
    if (!canManageUsers) return
    setUserForm({
      id: membership.id,
      name: membership.user.name ?? '',
      username: membership.user.username,
      phone: membership.user.phone ?? '',
      password: '',
      systemRole: membership.systemRole,
      customRoleId: membership.customRoleId ?? '',
      activeEventDateId: membership.activeEventDateId ?? '',
    })
    setShowPassword(false)
    setIsUserModalOpen(true)
  }

  function togglePermission(permissionKey: string) {
    setRoleForm((current) => {
      const next = new Set(current.permissionKeys)
      if (next.has(permissionKey)) next.delete(permissionKey)
      else next.add(permissionKey)
      return { ...current, permissionKeys: Array.from(next) }
    })
  }

  function toggleGroup(group: PermissionCatalogGroup, checked: boolean) {
    setRoleForm((current) => {
      const next = new Set(current.permissionKeys)
      for (const permission of group.permissions) {
        if (checked) next.add(permission.key)
        else next.delete(permission.key)
      }
      return { ...current, permissionKeys: Array.from(next) }
    })
  }

  function selectAllPermissions() {
    setRoleForm((current) => ({
      ...current,
      permissionKeys: permissionGroups.flatMap((group) => group.permissions.map((permission) => permission.key)),
    }))
  }

  function clearRolePermissions() {
    setRoleForm((current) => ({ ...current, permissionKeys: [] }))
  }

  async function saveRole() {
    if (!canManageRoles) return
    const name = roleForm.name.trim()
    if (!name) {
      alert('Informe o nome do cargo.')
      return
    }

    try {
      setIsSavingRole(true)
      if (roleForm.id) {
        await updateAccessRole(roleForm.id, {
          name,
          description: roleForm.description,
          active: roleForm.active,
          permissionKeys: roleForm.permissionKeys,
        })
      } else {
        await createAccessRole({
          name,
          description: roleForm.description,
          permissionKeys: roleForm.permissionKeys,
        })
      }

      await loadData()
      setIsRoleModalOpen(false)
      setRoleForm(emptyRoleForm)
    } catch (error: any) {
      console.error('Erro ao salvar cargo:', error)
      alert(error?.message || 'Erro ao salvar cargo')
    } finally {
      setIsSavingRole(false)
    }
  }

  async function removeRole(role: AccessRole) {
    if (!canManageRoles) return
    if (!confirm(`Excluir o cargo "${role.name}"? Usuários com este cargo ficarão sem cargo customizado.`)) return

    try {
      setIsDeletingRoleId(role.id)
      await deleteAccessRole(role.id)
      await loadData()
    } catch (error: any) {
      console.error('Erro ao excluir cargo:', error)
      alert(error?.message || 'Erro ao excluir cargo')
    } finally {
      setIsDeletingRoleId(null)
    }
  }

  async function saveUser() {
    if (!canManageUsers) return
    const username = userForm.username.trim()
    const password = userForm.password.trim()

    if (!username) {
      alert('Informe o usuário de login.')
      return
    }

    if (username.length < 3) {
      alert('O usuário deve ter pelo menos 3 caracteres.')
      return
    }

    if (!userForm.id && (!password || password.length < 6)) {
      alert('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    if (userForm.id && password && password.length < 6) {
      alert('A nova senha deve ter pelo menos 6 caracteres.')
      return
    }

    if (userForm.systemRole === 'CUSTOM' && !userForm.customRoleId) {
      alert('Selecione um cargo para o usuário.')
      return
    }

    try {
      setIsSavingUser(true)
      const payload = {
        username,
        password: password || null,
        name: userForm.name,
        phone: userForm.phone,
        systemRole: userForm.systemRole,
        customRoleId: userForm.systemRole === 'ADMIN' ? null : userForm.customRoleId,
        activeEventDateId: userForm.activeEventDateId || null,
      }

      if (userForm.id) await updateAccessUser(userForm.id, payload)
      else await createAccessUser({ ...payload, password })

      await loadData()
      setIsUserModalOpen(false)
      setUserForm(emptyUserForm)
      setShowPassword(false)
    } catch (error: any) {
      console.error('Erro ao salvar usuário:', error)
      alert(error?.message || 'Erro ao salvar usuário')
    } finally {
      setIsSavingUser(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-foreground">
        <div className="flex items-center gap-3 rounded-2xl border bg-card px-5 py-4 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">Carregando acessos...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-background p-3 text-foreground sm:p-4 md:p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 md:gap-6">
        <header className="overflow-hidden rounded-3xl border bg-card shadow-sm">
          <div className="flex flex-col justify-between gap-4 p-4 sm:p-5 md:flex-row md:items-center">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight">Acessos</h1>
                <p className="max-w-3xl text-sm text-muted-foreground">
                  Gerencie usuários e cargos customizados. As permissões controlam o que cada pessoa pode ver ou alterar.
                </p>
              </div>
            </div>

            {canManageAccess && (
              <div className="flex flex-wrap gap-2">
                {canManageRoles && (
                  <button type="button" onClick={openNewRoleModal} className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-bold transition hover:bg-muted">
                    <Plus className="h-4 w-4" /> Novo cargo
                  </button>
                )}
                {canManageUsers && (
                  <button type="button" onClick={openNewUserModal} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-90">
                    <UserPlus className="h-4 w-4" /> Novo usuário
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 border-t bg-muted/30 md:grid-cols-4">
            <div className="border-b p-4 md:border-b-0 md:border-r">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Usuários</p>
              <p className="mt-1 text-2xl font-black">{users.length}</p>
            </div>
            <div className="border-b p-4 md:border-b-0 md:border-r">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Admins</p>
              <p className="mt-1 text-2xl font-black">{users.filter((membership) => membership.systemRole === 'ADMIN').length}</p>
            </div>
            <div className="border-b p-4 md:border-b-0 md:border-r">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Cargos ativos</p>
              <p className="mt-1 text-2xl font-black">{activeRoles.length}</p>
            </div>
            <div className="p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Permissões disponíveis</p>
              <p className="mt-1 text-2xl font-black">{totalPermissions}</p>
            </div>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[440px_1fr] xl:gap-6">
          <section className="rounded-3xl border bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-black">Cargos customizados</h2>
                <p className="text-xs text-muted-foreground">Edite permissões pelo modal para manter a tela limpa.</p>
              </div>
              <KeyRound className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="mb-3 flex h-10 items-center gap-2 rounded-2xl border bg-background px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={roleSearch} onChange={(event) => setRoleSearch(event.target.value)} placeholder="Buscar cargo..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </div>

            <div className="space-y-3">
              {filteredRoles.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">Nenhum cargo encontrado.</div>
              ) : (
                filteredRoles.map((role) => (
                  <article key={role.id} className="rounded-2xl border bg-background p-4 transition hover:border-primary/40">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-black">{role.name}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${role.active ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
                            {role.active ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{role.description || 'Sem descrição'}</p>
                      </div>
                      {canManageRoles && (
                        <div className="flex shrink-0 gap-1">
                          <button type="button" onClick={() => openEditRoleModal(role)} className="flex h-9 w-9 items-center justify-center rounded-xl border transition hover:bg-muted" title="Editar cargo">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => removeRole(role)} disabled={isDeletingRoleId === role.id} className="flex h-9 w-9 items-center justify-center rounded-xl border text-destructive transition hover:bg-destructive/10 disabled:opacity-50" title="Excluir cargo">
                            {isDeletingRoleId === role.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border bg-card px-2.5 py-1 font-bold">{permissionCountLabel(role.permissions.length)}</span>
                      <span className="rounded-full border bg-card px-2.5 py-1 text-muted-foreground">{role._count?.memberships ?? 0} usuários</span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {rolePermissionKeys(role).slice(0, 8).map((permission) => (
                        <span key={permission} className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">{permission}</span>
                      ))}
                      {role.permissions.length > 8 && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">+{role.permissions.length - 8}</span>}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl border bg-card p-4 shadow-sm">
            <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <h2 className="font-black">Usuários</h2>
                <p className="text-xs text-muted-foreground">Crie e edite login, senha e permissões em modal.</p>
              </div>
              <div className="flex h-10 items-center gap-2 rounded-2xl border bg-background px-3 md:w-80">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Buscar usuário..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {filteredUsers.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground md:col-span-2">Nenhum usuário encontrado.</div>
              ) : (
                filteredUsers.map((membership) => {
                  const isAdmin = membership.systemRole === 'ADMIN'
                  const permissionKeys = isAdmin ? [] : rolePermissionKeys(membership.customRole)

                  return (
                    <article key={membership.id} className="rounded-2xl border bg-background p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            {isAdmin ? <ShieldCheck className="h-5 w-5" /> : <UserCog className="h-5 w-5" />}
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate font-black">{membership.user.name || membership.user.username}</h3>
                            <p className="truncate text-sm text-muted-foreground">@{membership.user.username}</p>
                          </div>
                        </div>
                        {canManageUsers && (
                          <button type="button" onClick={() => openEditUserModal(membership)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition hover:bg-muted" title="Editar usuário">
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 text-xs">
                        <span className={`rounded-full px-2.5 py-1 font-bold ${isAdmin ? 'bg-primary text-primary-foreground' : 'border bg-card'}`}>
                          {isAdmin ? 'Admin total' : membership.customRole?.name ?? 'Sem cargo'}
                        </span>
                        {!isAdmin && <span className="rounded-full border bg-card px-2.5 py-1 text-muted-foreground">{permissionCountLabel(permissionKeys.length)}</span>}
                        <span className="rounded-full border bg-card px-2.5 py-1 text-muted-foreground">Evento: {membership.activeEventDate?.title ?? 'Nenhum'}</span>
                      </div>

                      {!isAdmin && permissionKeys.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {permissionKeys.slice(0, 7).map((permission) => (
                            <span key={permission} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{permission}</span>
                          ))}
                          {permissionKeys.length > 7 && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">+{permissionKeys.length - 7}</span>}
                        </div>
                      )}
                    </article>
                  )
                })
              )}
            </div>
          </section>
        </div>
      </div>

      <Modal
        open={isRoleModalOpen}
        onClose={() => !isSavingRole && setIsRoleModalOpen(false)}
        title={roleForm.id ? 'Editar cargo' : 'Criar cargo'}
        description="Defina o nome do cargo e marque exatamente o que esse acesso pode ver ou alterar."
        icon={<KeyRound className="h-5 w-5" />}
        footer={
          <>
            <button type="button" onClick={() => setIsRoleModalOpen(false)} disabled={isSavingRole} className="rounded-2xl border px-4 py-2 text-sm font-bold transition hover:bg-muted disabled:opacity-60">Cancelar</button>
            <button type="button" onClick={saveRole} disabled={isSavingRole} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60">
              {isSavingRole ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Salvar cargo
            </button>
          </>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Nome do cargo</span>
            <input value={roleForm.name} onChange={(event) => setRoleForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex: Caixa, Estoque, Gerente" className="h-11 w-full rounded-2xl border bg-background px-3 text-sm outline-none ring-primary/20 transition focus:ring-4" />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Status</span>
            <select value={roleForm.active ? 'active' : 'inactive'} onChange={(event) => setRoleForm((current) => ({ ...current, active: event.target.value === 'active' }))} className="h-11 w-full rounded-2xl border bg-background px-3 text-sm outline-none ring-primary/20 transition focus:ring-4">
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </label>
        </div>

        <label className="mt-4 block space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Descrição</span>
          <textarea value={roleForm.description} onChange={(event) => setRoleForm((current) => ({ ...current, description: event.target.value }))} placeholder="Explique para que esse cargo será usado" className="min-h-20 w-full rounded-2xl border bg-background px-3 py-2 text-sm outline-none ring-primary/20 transition focus:ring-4" />
        </label>

        <div className="mt-5 rounded-3xl border bg-background p-4">
          <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <h3 className="font-black">Permissões</h3>
              <p className="text-xs text-muted-foreground">{permissionCountLabel(roleForm.permissionKeys.length)} selecionadas</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={selectAllPermissions} className="rounded-xl border px-3 py-2 text-xs font-bold transition hover:bg-muted">Selecionar tudo</button>
              <button type="button" onClick={clearRolePermissions} className="rounded-xl border px-3 py-2 text-xs font-bold transition hover:bg-muted">Limpar</button>
            </div>
          </div>

          <div className="mb-4 flex h-10 items-center gap-2 rounded-2xl border bg-card px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={permissionSearch} onChange={(event) => setPermissionSearch(event.target.value)} placeholder="Buscar permissão..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {filteredPermissionGroups.map((group) => {
              const groupKeys = group.permissions.map((permission) => permission.key)
              const selectedInGroup = groupKeys.filter((key) => selectedPermissions.has(key)).length
              const allSelected = selectedInGroup === groupKeys.length && groupKeys.length > 0

              return (
                <section key={group.group} className="rounded-2xl border bg-card p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-black">{group.group}</h4>
                      <p className="text-xs text-muted-foreground">{selectedInGroup}/{group.permissions.length} selecionadas</p>
                    </div>
                    <button type="button" onClick={() => toggleGroup(group, !allSelected)} className="rounded-xl border px-3 py-1.5 text-xs font-bold transition hover:bg-muted">
                      {allSelected ? 'Remover' : 'Marcar'}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {group.permissions.map((permission) => {
                      const checked = selectedPermissions.has(permission.key)
                      return (
                        <button key={permission.key} type="button" onClick={() => togglePermission(permission.key)} className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition ${checked ? 'border-primary bg-primary/10' : 'bg-background hover:bg-muted'}`}>
                          <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${checked ? 'border-primary bg-primary text-primary-foreground' : 'bg-card'}`}>
                            {checked && <Check className="h-3.5 w-3.5" />}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-bold">{permission.label}</span>
                            <span className="block break-all text-xs text-muted-foreground">{permission.key}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      </Modal>

      <Modal
        open={isUserModalOpen}
        onClose={() => !isSavingUser && setIsUserModalOpen(false)}
        title={userForm.id ? 'Editar usuário' : 'Criar usuário'}
        description={userForm.id ? 'Atualize login, dados básicos, senha e cargo.' : 'Crie um login e já vincule ao Admin ou a um cargo customizado.'}
        icon={<UserPlus className="h-5 w-5" />}
        maxWidth="max-w-2xl"
        footer={
          <>
            <button type="button" onClick={() => setIsUserModalOpen(false)} disabled={isSavingUser} className="rounded-2xl border px-4 py-2 text-sm font-bold transition hover:bg-muted disabled:opacity-60">Cancelar</button>
            <button type="button" onClick={saveUser} disabled={isSavingUser} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60">
              {isSavingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Salvar usuário
            </button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Nome exibido</span>
            <input value={userForm.name} onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex: Maria Caixa" className="h-11 w-full rounded-2xl border bg-background px-3 text-sm outline-none ring-primary/20 transition focus:ring-4" />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Usuário/login</span>
            <input value={userForm.username} onChange={(event) => setUserForm((current) => ({ ...current, username: event.target.value }))} placeholder="maria.caixa" className="h-11 w-full rounded-2xl border bg-background px-3 text-sm outline-none ring-primary/20 transition focus:ring-4" />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Telefone</span>
            <input value={userForm.phone} onChange={(event) => setUserForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Opcional" className="h-11 w-full rounded-2xl border bg-background px-3 text-sm outline-none ring-primary/20 transition focus:ring-4" />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{userForm.id ? 'Nova senha' : 'Senha inicial'}</span>
            <div className="flex h-11 overflow-hidden rounded-2xl border bg-background ring-primary/20 transition focus-within:ring-4">
              <input type={showPassword ? 'text' : 'password'} value={userForm.password} onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))} placeholder={userForm.id ? 'Deixe vazio para manter' : 'Mínimo 6 caracteres'} className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" />
              <button type="button" onClick={() => setShowPassword((current) => !current)} className="flex w-11 items-center justify-center text-muted-foreground transition hover:bg-muted" title={showPassword ? 'Esconder senha' : 'Mostrar senha'}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Tipo de acesso</span>
            <select value={userForm.systemRole} onChange={(event) => setUserForm((current) => ({ ...current, systemRole: event.target.value as 'ADMIN' | 'CUSTOM', customRoleId: event.target.value === 'ADMIN' ? '' : current.customRoleId }))} className="h-11 w-full rounded-2xl border bg-background px-3 text-sm outline-none ring-primary/20 transition focus:ring-4">
              <option value="CUSTOM">Cargo customizado</option>
              <option value="ADMIN">Admin total</option>
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Cargo</span>
            <select value={userForm.customRoleId} disabled={userForm.systemRole === 'ADMIN'} onChange={(event) => setUserForm((current) => ({ ...current, customRoleId: event.target.value }))} className="h-11 w-full rounded-2xl border bg-background px-3 text-sm outline-none ring-primary/20 transition focus:ring-4 disabled:opacity-50">
              <option value="">Selecione um cargo</option>
              {activeRoles.map((role) => (
                <option key={role.id} value={role.id}>{role.name} · {permissionCountLabel(role.permissions.length)}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5 md:col-span-2">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Evento ativo deste usuário</span>
            <select value={userForm.activeEventDateId} onChange={(event) => setUserForm((current) => ({ ...current, activeEventDateId: event.target.value }))} className="h-11 w-full rounded-2xl border bg-background px-3 text-sm outline-none ring-primary/20 transition focus:ring-4">
              <option value="">Nenhum evento ativo definido</option>
              {eventDates.map((eventDate) => (
                <option key={eventDate.id} value={eventDate.id}>{formatEventDateLabel(eventDate)}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Usado como evento ativo inicial quando esse usuário entrar no sistema.</p>
          </label>
        </div>

        {userForm.systemRole === 'ADMIN' ? (
          <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/10 p-4 text-sm text-primary">
            <div className="flex items-start gap-2">
              <Shield className="mt-0.5 h-4 w-4 shrink-0" />
              <p><strong>Admin total:</strong> este usuário poderá ver e alterar tudo, incluindo cargos, usuários e auditoria.</p>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border bg-background p-4">
            <p className="text-sm font-bold">Permissões do cargo selecionado</p>
            {(() => {
              const selectedRole = roles.find((role) => role.id === userForm.customRoleId)
              const keys = rolePermissionKeys(selectedRole)
              if (!selectedRole) return <p className="mt-2 text-sm text-muted-foreground">Selecione um cargo para visualizar as permissões.</p>
              if (keys.length === 0) return <p className="mt-2 text-sm text-muted-foreground">Este cargo não possui permissões.</p>
              return (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {keys.map((permission) => <span key={permission} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{permission}</span>)}
                </div>
              )
            })()}
          </div>
        )}
      </Modal>
    </div>
  )
}
