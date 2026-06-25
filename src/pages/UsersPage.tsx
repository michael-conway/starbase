import { useMemo, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  PasswordInput,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Autocomplete,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import {
  IconAlertCircle,
  IconDatabase,
  IconEdit,
  IconListDetails,
  IconPlus,
  IconTrash,
  IconUser,
  IconUsersGroup,
} from '@tabler/icons-react'
import {
  AVUMetadataTable,
  type AVUFormState,
  type AVURow,
} from '../features/avu-metadata'
import {
  ApiError,
  addUserAVU,
  addUserGroupAVU,
  addUserGroupMember,
  createUser,
  createUserGroup,
  deleteUser,
  deleteUserAVU,
  deleteUserGroupAVU,
  deleteUserGroup,
  getUserAVUs,
  getUserGroupAVUs,
  getUserGroup,
  getUserGroupSummaries,
  getUserMembershipSummaries,
  type IRODSUserMutationType,
  type UserGroupMember,
  type UserGroupSummary,
  type UserMembershipSummary,
  removeUserGroupMember,
  searchUsers,
  updateUserPassword,
  updateUserType,
  updateUserAVU,
  updateUserGroupAVU,
  userAVUCacheKey,
  userGroupAVUCacheKey,
  userGroupDetailCacheKey,
  userGroupSummaryCacheKey,
  userMembershipSummaryCacheKey,
} from '../lib/irods-rest'
import { useSession } from '../providers/use-session'

const userTypeOptions: Array<{ value: IRODSUserMutationType; label: string }> = [
  { value: 'rodsuser', label: 'rodsuser' },
  { value: 'rodsadmin', label: 'rodsadmin' },
]

const rodsadminUserTypeOptions: Array<{ value: IRODSUserMutationType; label: string }> = [
  ...userTypeOptions,
  { value: 'groupadmin', label: 'groupadmin' },
]

const groupadminUserTypeOptions: Array<{ value: IRODSUserMutationType; label: string }> = [
  { value: 'rodsuser', label: 'rodsuser' },
]

function isUserMutationType(value: string | null): value is IRODSUserMutationType {
  return value === 'rodsuser' || value === 'rodsadmin' || value === 'groupadmin'
}

function isUnauthorized(error: Error) {
  return error instanceof ApiError && error.status === 403
}

function errorTitle(error: Error) {
  return isUnauthorized(error)
    ? 'Not authorized to list users and groups'
    : 'Unable to load users and groups'
}

function errorMessage(error: Error) {
  if (isUnauthorized(error)) {
    return 'The REST service denied access for this iRODS session.'
  }

  return error.message
}

function errorColor(error: Error) {
  return error instanceof ApiError && error.status === 403
    ? 'yellow'
    : 'red'
}

function userMutationErrorMessage(error: unknown, action: 'create' | 'update' | 'delete') {
  if (!(error instanceof ApiError)) {
    return `Unable to ${action} user. Check the service connection and try again.`
  }

  if (error.status === 409) {
    return action === 'create'
      ? 'A user or group with that name already exists.'
      : 'The user could not be changed because the requested state conflicts with the catalog.'
  }

  if (error.status === 403) {
    return 'This iRODS session is not allowed to administer users.'
  }

  if (error.status === 404) {
    return 'The selected user was not found. Refresh the list and try again.'
  }

  return error.message
}

function groupMutationErrorMessage(
  error: unknown,
  action: 'create' | 'delete' | 'add-member' | 'remove-member',
) {
  if (!(error instanceof ApiError)) {
    return 'Unable to update group state. Check the service connection and try again.'
  }

  if (error.status === 409) {
    return action === 'create'
      ? 'A user or group with that name already exists.'
      : 'The requested group membership already exists or conflicts with the catalog.'
  }

  if (error.status === 403) {
    return 'This iRODS session is not allowed to administer groups.'
  }

  if (error.status === 404) {
    return 'The selected group or user was not found. Refresh the list and try again.'
  }

  return error.message
}

function normalizedPrefix(value: string) {
  const trimmed = value.trim()
  return trimmed.length >= 3 ? trimmed : undefined
}

function formatPrincipalName(userName: string, userZone: string, groupZone?: string) {
  return groupZone && userZone && userZone !== groupZone
    ? `${userName}#${userZone}`
    : userName
}

function emptyAVUForm(): AVUFormState {
  return {
    attrib: '',
    value: '',
    unit: '',
  }
}

export function UsersPage() {
  const { connection, currentUserMembership } = useSession()
  const queryClient = useQueryClient()
  const [zone, setZone] = useState('')
  const [prefix, setPrefix] = useState('')
  const [createOpened, setCreateOpened] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createType, setCreateType] = useState<IRODSUserMutationType>('rodsuser')
  const [createPassword, setCreatePassword] = useState('')
  const [createZone, setCreateZone] = useState('')
  const [editingUser, setEditingUser] = useState<UserMembershipSummary | null>(null)
  const [editType, setEditType] = useState<IRODSUserMutationType | ''>('rodsuser')
  const [editPassword, setEditPassword] = useState('')
  const [editZone, setEditZone] = useState('')
  const [deletingUser, setDeletingUser] = useState<UserMembershipSummary | null>(null)
  const [createGroupOpened, setCreateGroupOpened] = useState(false)
  const [createGroupName, setCreateGroupName] = useState('')
  const [createGroupZone, setCreateGroupZone] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<UserGroupSummary | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<UserGroupSummary | null>(null)
  const [removingMember, setRemovingMember] = useState<UserGroupMember | null>(null)
  const [memberName, setMemberName] = useState('')
  const [metadataUser, setMetadataUser] = useState<UserMembershipSummary | null>(null)
  const [isAddingUserAVU, setIsAddingUserAVU] = useState(false)
  const [editingUserAVU, setEditingUserAVU] = useState<AVURow | null>(null)
  const [userAVUForm, setUserAVUForm] = useState<AVUFormState>(emptyAVUForm)
  const [isAddingGroupAVU, setIsAddingGroupAVU] = useState(false)
  const [editingGroupAVU, setEditingGroupAVU] = useState<AVURow | null>(null)
  const [groupAVUForm, setGroupAVUForm] = useState<AVUFormState>(emptyAVUForm)
  const currentUser = currentUserMembership?.current_user.user
  const isCurrentRodsadmin = Boolean(currentUserMembership?.current_user.is_rodsadmin)
  const isCurrentGroupadmin = Boolean(currentUserMembership?.current_user.is_groupadmin)
  const canCreateUsers = isCurrentRodsadmin || isCurrentGroupadmin
  const canManageGroups = isCurrentRodsadmin || isCurrentGroupadmin
  const canEditUsers = isCurrentRodsadmin
  const canDeleteUsers = isCurrentRodsadmin
  const canDeleteGroups = isCurrentRodsadmin
  const canSetGroupadmin = isCurrentRodsadmin
  const availableUserTypeOptions = isCurrentRodsadmin
    ? rodsadminUserTypeOptions
    : groupadminUserTypeOptions
  const queryPrefix = normalizedPrefix(prefix)
  const queryOptions = useMemo(
    () => ({
      zone: zone.trim() || undefined,
      prefix: queryPrefix,
      limit: 500,
    }),
    [queryPrefix, zone],
  )
  const usersQuery = useQuery({
    queryKey: userMembershipSummaryCacheKey(
      connection.baseUrl,
      connection.auth.mode,
      queryOptions,
    ),
    queryFn: () =>
      getUserMembershipSummaries(connection.auth, connection.baseUrl, queryOptions),
  })
  const groupsQuery = useQuery({
    queryKey: userGroupSummaryCacheKey(
      connection.baseUrl,
      connection.auth.mode,
      queryOptions,
    ),
    queryFn: () =>
      getUserGroupSummaries(connection.auth, connection.baseUrl, queryOptions),
  })
  const selectedGroupQuery = useQuery({
    queryKey: userGroupDetailCacheKey(
      connection.baseUrl,
      connection.auth.mode,
      selectedGroup?.name ?? '',
      { zone: selectedGroup?.zone },
    ),
    queryFn: () => {
      if (!selectedGroup) {
        throw new ApiError(400, 'Select a group.')
      }

      return getUserGroup(selectedGroup.name, connection.auth, connection.baseUrl, {
        zone: selectedGroup.zone,
      })
    },
    enabled: Boolean(selectedGroup),
  })
  const userAVUQuery = useQuery({
    queryKey: userAVUCacheKey(
      connection.baseUrl,
      connection.auth.mode,
      metadataUser?.name ?? '',
      { zone: metadataUser?.zone },
    ),
    queryFn: () => {
      if (!metadataUser) {
        throw new ApiError(400, 'Select a user.')
      }

      return getUserAVUs(metadataUser.name, connection.auth, connection.baseUrl, {
        zone: metadataUser.zone,
      })
    },
    enabled: Boolean(metadataUser),
  })
  const groupAVUQuery = useQuery({
    queryKey: userGroupAVUCacheKey(
      connection.baseUrl,
      connection.auth.mode,
      selectedGroup?.name ?? '',
      { zone: selectedGroup?.zone },
    ),
    queryFn: () => {
      if (!selectedGroup) {
        throw new ApiError(400, 'Select a group.')
      }

      return getUserGroupAVUs(selectedGroup.name, connection.auth, connection.baseUrl, {
        zone: selectedGroup.zone,
      })
    },
    enabled: Boolean(selectedGroup),
  })
  const memberSearchQuery = useQuery({
    queryKey: [
      'group-member-user-search',
      connection.baseUrl,
      connection.auth.mode,
      selectedGroup?.zone ?? '',
      memberName.trim(),
    ],
    queryFn: () =>
      searchUsers(memberName.trim(), connection.auth, connection.baseUrl, {
        zone: selectedGroup?.zone,
      }),
    enabled: Boolean(selectedGroup) && memberName.trim().length >= 3,
  })
  const selectedGroupMembers = selectedGroupQuery.data?.group.members ?? []
  const selectedGroupIsEmpty = selectedGroupQuery.isSuccess && selectedGroupMembers.length === 0
  const currentUserPrincipalName = currentUser
    ? formatPrincipalName(currentUser.name, currentUser.zone, selectedGroup?.zone)
    : ''
  const currentUserIsSelectedGroupMember = Boolean(
    currentUser &&
      selectedGroupMembers.some(
        (member) =>
          member.name === currentUser.name &&
          (!member.zone || !currentUser.zone || member.zone === currentUser.zone),
      ),
  )
  const groupadminNeedsSelfMembership =
    isCurrentGroupadmin &&
    !isCurrentRodsadmin &&
    selectedGroupIsEmpty &&
    Boolean(currentUserPrincipalName)
  const canManageSelectedGroupMembers =
    isCurrentRodsadmin ||
    (isCurrentGroupadmin &&
      (currentUserIsSelectedGroupMember || groupadminNeedsSelfMembership))
  const addMemberName = groupadminNeedsSelfMembership ? currentUserPrincipalName : memberName
  const invalidateUserQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['user-membership-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['users'] }),
      queryClient.invalidateQueries({ queryKey: ['user'] }),
      queryClient.invalidateQueries({ queryKey: ['user-groups-for-user'] }),
      queryClient.invalidateQueries({ queryKey: ['user-group-summary'] }),
    ])
  }
  const invalidateGroupQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['user-group-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['user-groups'] }),
      queryClient.invalidateQueries({ queryKey: ['user-group'] }),
      queryClient.invalidateQueries({ queryKey: ['user-membership-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['user-groups-for-user'] }),
    ])
  }
  const invalidateUserAVUQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: ['user-avus'] })
  }
  const invalidateGroupAVUQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: ['user-group-avus'] })
  }
  const createUserMutation = useMutation({
    mutationFn: () =>
      createUser(
        {
          name: createName,
          type: isCurrentRodsadmin ? createType : 'rodsuser',
          password: createPassword.trim() || undefined,
        },
        connection.auth,
        connection.baseUrl,
        {
          zone: createZone.trim() || undefined,
          reconcile: false,
        },
      ),
    onSuccess: async () => {
      await invalidateUserQueries()
      setCreateOpened(false)
      setCreateName('')
      setCreateType('rodsuser')
      setCreatePassword('')
      setCreateZone('')
    },
  })
  const updateUserMutation = useMutation({
    mutationFn: async () => {
      if (!editingUser) {
        throw new ApiError(400, 'Select a user to edit.')
      }

      if (!isCurrentRodsadmin) {
        throw new ApiError(403, 'Only rodsadmin users can change user type or password.')
      }

      const zoneOptions = {
        zone: editZone.trim() || undefined,
      }
      const trimmedPassword = editPassword.trim()
      let result

      if (editType && editType !== editingUser.type) {
        result = await updateUserType(
          editingUser.name,
          { type: editType },
          connection.auth,
          connection.baseUrl,
          zoneOptions,
        )
      }

      if (trimmedPassword) {
        result = await updateUserPassword(
          editingUser.name,
          { password: trimmedPassword },
          connection.auth,
          connection.baseUrl,
          zoneOptions,
        )
      }

      if (!result) {
        throw new ApiError(400, 'Choose a user type change or enter a new password.')
      }

      return result
    },
    onSuccess: async () => {
      await invalidateUserQueries()
      setEditingUser(null)
      setEditPassword('')
      setEditZone('')
    },
  })
  const deleteUserMutation = useMutation({
    mutationFn: () => {
      if (!deletingUser) {
        throw new ApiError(400, 'Select a user to delete.')
      }

      return deleteUser(deletingUser.name, connection.auth, connection.baseUrl, {
        zone: deletingUser.zone,
      })
    },
    onSuccess: async () => {
      await invalidateUserQueries()
      setDeletingUser(null)
    },
  })
  const createGroupMutation = useMutation({
    mutationFn: () =>
      createUserGroup(
        {
          name: createGroupName,
        },
        connection.auth,
        connection.baseUrl,
        {
          zone: createGroupZone.trim() || undefined,
          reconcile: false,
        },
      ),
    onSuccess: async (response) => {
      await invalidateGroupQueries()
      setCreateGroupOpened(false)
      setCreateGroupName('')
      setCreateGroupZone('')
      if (isCurrentGroupadmin && !isCurrentRodsadmin) {
        setSelectedGroup({
          id: response.group.id,
          name: response.group.name,
          zone: response.group.zone,
          type: response.group.type,
          member_count: response.group.members?.length ?? 0,
        })
        setMemberName(
          currentUser
            ? formatPrincipalName(currentUser.name, currentUser.zone, response.group.zone)
            : '',
        )
      }
    },
  })
  const deleteGroupMutation = useMutation({
    mutationFn: () => {
      if (!deletingGroup) {
        throw new ApiError(400, 'Select a group to delete.')
      }

      if (!isCurrentRodsadmin) {
        throw new ApiError(403, 'Only rodsadmin users can delete groups.')
      }

      return deleteUserGroup(deletingGroup.name, connection.auth, connection.baseUrl, {
        zone: deletingGroup.zone,
      })
    },
    onSuccess: async () => {
      await invalidateGroupQueries()
      if (selectedGroup?.name === deletingGroup?.name && selectedGroup?.zone === deletingGroup?.zone) {
        setSelectedGroup(null)
      }
      setDeletingGroup(null)
    },
  })
  const addMemberMutation = useMutation({
    mutationFn: () => {
      if (!selectedGroup) {
        throw new ApiError(400, 'Select a group.')
      }

      return addUserGroupMember(
        selectedGroup.name,
        {
          user_name: addMemberName,
        },
        connection.auth,
        connection.baseUrl,
        {
          zone: selectedGroup.zone,
        },
      )
    },
    onSuccess: async () => {
      await invalidateGroupQueries()
      setMemberName('')
    },
  })
  const removeMemberMutation = useMutation({
    mutationFn: (member: UserGroupMember) => {
      if (!selectedGroup) {
        throw new ApiError(400, 'Select a group.')
      }

      return removeUserGroupMember(
        selectedGroup.name,
        member.name,
        connection.auth,
        connection.baseUrl,
        {
          zone: selectedGroup.zone,
        },
      )
    },
    onSuccess: async () => {
      await invalidateGroupQueries()
      setRemovingMember(null)
    },
  })
  const addUserAVUMutation = useMutation({
    mutationFn: () => {
      if (!metadataUser) {
        throw new ApiError(400, 'Select a user.')
      }

      if (!isCurrentRodsadmin) {
        throw new ApiError(403, 'Only rodsadmin users can create user AVUs.')
      }

      if (!userAVUQuery.data?.links?.create) {
        throw new ApiError(403, 'This iRODS session is not allowed to create user AVUs.')
      }

      return addUserAVU(
        metadataUser.name,
        {
          attrib: userAVUForm.attrib.trim(),
          value: userAVUForm.value.trim(),
          unit: userAVUForm.unit.trim(),
        },
        connection.auth,
        connection.baseUrl,
        {
          zone: metadataUser.zone,
        },
      )
    },
    onSuccess: async () => {
      notifications.show({
        title: 'AVU added',
        message: 'User metadata entry created.',
        color: 'teal',
      })
      setIsAddingUserAVU(false)
      setUserAVUForm(emptyAVUForm())
      await invalidateUserAVUQueries()
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'AVU add failed',
        message: error.message,
        color: 'red',
      })
    },
  })
  const updateUserAVUMutation = useMutation({
    mutationFn: () => {
      if (!metadataUser || !editingUserAVU) {
        throw new ApiError(400, 'Select a user AVU.')
      }

      if (!isCurrentRodsadmin) {
        throw new ApiError(403, 'Only rodsadmin users can update user AVUs.')
      }

      if (!editingUserAVU.links?.update) {
        throw new ApiError(403, 'This iRODS session is not allowed to update this user AVU.')
      }

      return updateUserAVU(
        metadataUser.name,
        editingUserAVU.id,
        {
          attrib: userAVUForm.attrib.trim(),
          value: userAVUForm.value.trim(),
          unit: userAVUForm.unit.trim(),
        },
        connection.auth,
        connection.baseUrl,
        {
          zone: metadataUser.zone,
        },
      )
    },
    onSuccess: async () => {
      notifications.show({
        title: 'AVU updated',
        message: 'User metadata entry replaced.',
        color: 'teal',
      })
      setEditingUserAVU(null)
      setUserAVUForm(emptyAVUForm())
      await invalidateUserAVUQueries()
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'AVU update failed',
        message: error.message,
        color: 'red',
      })
    },
  })
  const deleteUserAVUMutation = useMutation({
    mutationFn: (avu: AVURow) => {
      if (!metadataUser) {
        throw new ApiError(400, 'Select a user.')
      }

      if (!isCurrentRodsadmin) {
        throw new ApiError(403, 'Only rodsadmin users can delete user AVUs.')
      }

      if (!avu.links?.delete) {
        throw new ApiError(403, 'This iRODS session is not allowed to delete this user AVU.')
      }

      return deleteUserAVU(metadataUser.name, avu.id, connection.auth, connection.baseUrl, {
        zone: metadataUser.zone,
      })
    },
    onSuccess: async () => {
      notifications.show({
        title: 'AVU deleted',
        message: 'User metadata entry removed.',
        color: 'teal',
      })
      await invalidateUserAVUQueries()
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'AVU delete failed',
        message: error.message,
        color: 'red',
      })
    },
  })
  const addGroupAVUMutation = useMutation({
    mutationFn: () => {
      if (!selectedGroup) {
        throw new ApiError(400, 'Select a group.')
      }

      if (!groupAVUQuery.data?.links?.create) {
        throw new ApiError(403, 'This iRODS session is not allowed to create group AVUs.')
      }

      return addUserGroupAVU(
        selectedGroup.name,
        {
          attrib: groupAVUForm.attrib.trim(),
          value: groupAVUForm.value.trim(),
          unit: groupAVUForm.unit.trim(),
        },
        connection.auth,
        connection.baseUrl,
        {
          zone: selectedGroup.zone,
        },
      )
    },
    onSuccess: async () => {
      notifications.show({
        title: 'AVU added',
        message: 'Group metadata entry created.',
        color: 'teal',
      })
      setIsAddingGroupAVU(false)
      setGroupAVUForm(emptyAVUForm())
      await invalidateGroupAVUQueries()
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'AVU add failed',
        message: error.message,
        color: 'red',
      })
    },
  })
  const updateGroupAVUMutation = useMutation({
    mutationFn: () => {
      if (!selectedGroup || !editingGroupAVU) {
        throw new ApiError(400, 'Select a group AVU.')
      }

      if (!editingGroupAVU.links?.update) {
        throw new ApiError(403, 'This iRODS session is not allowed to update this group AVU.')
      }

      return updateUserGroupAVU(
        selectedGroup.name,
        editingGroupAVU.id,
        {
          attrib: groupAVUForm.attrib.trim(),
          value: groupAVUForm.value.trim(),
          unit: groupAVUForm.unit.trim(),
        },
        connection.auth,
        connection.baseUrl,
        {
          zone: selectedGroup.zone,
        },
      )
    },
    onSuccess: async () => {
      notifications.show({
        title: 'AVU updated',
        message: 'Group metadata entry replaced.',
        color: 'teal',
      })
      setEditingGroupAVU(null)
      setGroupAVUForm(emptyAVUForm())
      await invalidateGroupAVUQueries()
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'AVU update failed',
        message: error.message,
        color: 'red',
      })
    },
  })
  const deleteGroupAVUMutation = useMutation({
    mutationFn: (avu: AVURow) => {
      if (!selectedGroup) {
        throw new ApiError(400, 'Select a group.')
      }

      if (!avu.links?.delete) {
        throw new ApiError(403, 'This iRODS session is not allowed to delete this group AVU.')
      }

      return deleteUserGroupAVU(selectedGroup.name, avu.id, connection.auth, connection.baseUrl, {
        zone: selectedGroup.zone,
      })
    },
    onSuccess: async () => {
      notifications.show({
        title: 'AVU deleted',
        message: 'Group metadata entry removed.',
        color: 'teal',
      })
      await invalidateGroupAVUQueries()
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'AVU delete failed',
        message: error.message,
        color: 'red',
      })
    },
  })
  const openEditUser = (user: UserMembershipSummary) => {
    updateUserMutation.reset()
    setEditingUser(user)
    setEditType(
      isUserMutationType(user.type) &&
        (user.type !== 'groupadmin' || canSetGroupadmin)
        ? user.type
        : '',
    )
    setEditPassword('')
    setEditZone(user.zone)
  }
  const openDeleteUser = (user: UserMembershipSummary) => {
    deleteUserMutation.reset()
    setDeletingUser(user)
  }
  const openUserMetadata = (user: UserMembershipSummary) => {
    setMetadataUser(user)
    setIsAddingUserAVU(false)
    setEditingUserAVU(null)
    setUserAVUForm(emptyAVUForm())
    addUserAVUMutation.reset()
    updateUserAVUMutation.reset()
    deleteUserAVUMutation.reset()
  }
  const closeUserMetadata = () => {
    setMetadataUser(null)
    setIsAddingUserAVU(false)
    setEditingUserAVU(null)
    setUserAVUForm(emptyAVUForm())
  }
  const openGroupDetails = (group: UserGroupSummary) => {
    setSelectedGroup(group)
    setMemberName('')
    setIsAddingGroupAVU(false)
    setEditingGroupAVU(null)
    setGroupAVUForm(emptyAVUForm())
    addMemberMutation.reset()
    removeMemberMutation.reset()
    addGroupAVUMutation.reset()
    updateGroupAVUMutation.reset()
    deleteGroupAVUMutation.reset()
  }
  const closeGroupDetails = () => {
    setSelectedGroup(null)
    setIsAddingGroupAVU(false)
    setEditingGroupAVU(null)
    setGroupAVUForm(emptyAVUForm())
  }
  const openDeleteGroup = (group: UserGroupSummary) => {
    deleteGroupMutation.reset()
    setDeletingGroup(group)
  }
  const openRemoveMember = (member: UserGroupMember) => {
    removeMemberMutation.reset()
    setRemovingMember(member)
  }
  const memberOptions =
    memberSearchQuery.data?.users.map((user) =>
      user.zone === selectedGroup?.zone ? user.name : `${user.name}#${user.zone}`,
    ) ?? []

  const validateAVUForm = (form: AVUFormState) => {
    if (form.attrib.trim() && form.value.trim()) {
      return true
    }

    notifications.show({
      title: 'AVU is incomplete',
      message: 'Attribute and value are required.',
      color: 'red',
    })
    return false
  }
  const beginUserAVUAdd = () => {
    if (!isCurrentRodsadmin || !userAVUQuery.data?.links?.create) {
      return
    }

    setEditingUserAVU(null)
    setIsAddingUserAVU(true)
    setUserAVUForm(emptyAVUForm())
  }
  const beginUserAVUEdit = (avu: AVURow) => {
    if (!isCurrentRodsadmin || !avu.links?.update) {
      return
    }

    setIsAddingUserAVU(false)
    setEditingUserAVU(avu)
    setUserAVUForm({
      attrib: avu.attrib,
      value: avu.value,
      unit: avu.unit ?? '',
    })
  }
  const cancelUserAVUEditor = () => {
    setIsAddingUserAVU(false)
    setEditingUserAVU(null)
    setUserAVUForm(emptyAVUForm())
  }
  const submitUserAVUAdd = () => {
    if (validateAVUForm(userAVUForm)) {
      addUserAVUMutation.mutate()
    }
  }
  const submitUserAVUUpdate = () => {
    if (validateAVUForm(userAVUForm)) {
      updateUserAVUMutation.mutate()
    }
  }
  const beginUserAVUDelete = (avu: AVURow) => {
    if (!isCurrentRodsadmin || !avu.links?.delete) {
      return
    }

    const confirmed = window.confirm(`Delete AVU "${avu.attrib}" with value "${avu.value}"?`)
    if (confirmed) {
      deleteUserAVUMutation.mutate(avu)
    }
  }
  const beginGroupAVUAdd = () => {
    if (!groupAVUQuery.data?.links?.create) {
      return
    }

    setEditingGroupAVU(null)
    setIsAddingGroupAVU(true)
    setGroupAVUForm(emptyAVUForm())
  }
  const beginGroupAVUEdit = (avu: AVURow) => {
    if (!avu.links?.update) {
      return
    }

    setIsAddingGroupAVU(false)
    setEditingGroupAVU(avu)
    setGroupAVUForm({
      attrib: avu.attrib,
      value: avu.value,
      unit: avu.unit ?? '',
    })
  }
  const cancelGroupAVUEditor = () => {
    setIsAddingGroupAVU(false)
    setEditingGroupAVU(null)
    setGroupAVUForm(emptyAVUForm())
  }
  const submitGroupAVUAdd = () => {
    if (validateAVUForm(groupAVUForm)) {
      addGroupAVUMutation.mutate()
    }
  }
  const submitGroupAVUUpdate = () => {
    if (validateAVUForm(groupAVUForm)) {
      updateGroupAVUMutation.mutate()
    }
  }
  const beginGroupAVUDelete = (avu: AVURow) => {
    if (!avu.links?.delete) {
      return
    }

    const confirmed = window.confirm(`Delete AVU "${avu.attrib}" with value "${avu.value}"?`)
    if (confirmed) {
      deleteGroupAVUMutation.mutate(avu)
    }
  }

  return (
    <Stack gap="lg">
      <Modal
        opened={createOpened}
        onClose={() => {
          if (!createUserMutation.isPending) {
            setCreateOpened(false)
          }
        }}
        title="Create user"
        centered
      >
        <Stack gap="md">
          {createUserMutation.isError ? (
            <Alert color="red" variant="light" title="Unable to create user">
              {userMutationErrorMessage(createUserMutation.error, 'create')}
            </Alert>
          ) : null}
          <TextInput
            label="Name"
            value={createName}
            onChange={(event) => setCreateName(event.currentTarget.value)}
          />
          <Select
            label="Type"
            value={createType}
            data={availableUserTypeOptions}
            allowDeselect={false}
            disabled={!isCurrentRodsadmin}
            onChange={(value) => {
              if (isUserMutationType(value)) {
                setCreateType(value)
              }
            }}
          />
          <PasswordInput
            label="Initial password"
            value={createPassword}
            onChange={(event) => setCreatePassword(event.currentTarget.value)}
          />
          <TextInput
            label="Zone"
            placeholder="Default zone"
            value={createZone}
            onChange={(event) => setCreateZone(event.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setCreateOpened(false)}
              disabled={createUserMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              loading={createUserMutation.isPending}
              disabled={!createName.trim()}
              onClick={() => createUserMutation.mutate()}
            >
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(editingUser)}
        onClose={() => {
          if (!updateUserMutation.isPending) {
            setEditingUser(null)
          }
        }}
        title={editingUser ? `Edit ${editingUser.name}` : 'Edit user'}
        centered
      >
        <Stack gap="md">
          {updateUserMutation.isError ? (
            <Alert color="red" variant="light" title="Unable to update user">
              {userMutationErrorMessage(updateUserMutation.error, 'update')}
            </Alert>
          ) : null}
          <Select
            label="Type"
            value={editType}
            data={availableUserTypeOptions}
            allowDeselect={
              !isUserMutationType(editingUser?.type ?? '') ||
              (editingUser?.type === 'groupadmin' && !canSetGroupadmin)
            }
            onChange={(value) => {
              if (isUserMutationType(value)) {
                setEditType(value)
                return
              }

              setEditType('')
            }}
          />
          <PasswordInput
            label="New password"
            value={editPassword}
            onChange={(event) => setEditPassword(event.currentTarget.value)}
          />
          <TextInput
            label="Zone"
            placeholder="Default zone"
            value={editZone}
            onChange={(event) => setEditZone(event.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setEditingUser(null)}
              disabled={updateUserMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              loading={updateUserMutation.isPending}
              disabled={editType === editingUser?.type && !editPassword.trim()}
              onClick={() => updateUserMutation.mutate()}
            >
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(metadataUser)}
        onClose={closeUserMetadata}
        title={metadataUser ? `Metadata for ${metadataUser.name}` : 'User metadata'}
        centered
        size="lg"
      >
        <Stack gap="md">
          {metadataUser ? (
            <Group gap="xs">
              <Badge variant="light" color="blue">
                {metadataUser.type}
              </Badge>
              <Badge variant="light" color="gray">
                {metadataUser.zone}
              </Badge>
            </Group>
          ) : null}

          <Group gap="xs" justify="space-between">
            <Group gap="xs">
              <ThemeIcon variant="light" color="orange" size="md">
                <IconDatabase size={14} />
              </ThemeIcon>
              <Title order={4}>AVU Metadata</Title>
            </Group>
            {isCurrentRodsadmin && userAVUQuery.data?.links?.create ? (
              <Button
                size="xs"
                variant="light"
                leftSection={<IconPlus size={14} />}
                loading={addUserAVUMutation.isPending}
                onClick={beginUserAVUAdd}
                disabled={isAddingUserAVU}
              >
                Add AVU
              </Button>
            ) : null}
          </Group>

          {userAVUQuery.isError ? (
            <Alert
              color={errorColor(userAVUQuery.error)}
              variant="light"
              icon={<IconAlertCircle size={18} />}
              title="Unable to load user AVUs"
            >
              {errorMessage(userAVUQuery.error)}
            </Alert>
          ) : (
            <AVUMetadataTable
              avus={userAVUQuery.data?.avus}
              canModify={isCurrentRodsadmin}
              editingAVUId={editingUserAVU?.id}
              form={userAVUForm}
              isAdding={isAddingUserAVU}
              isCreating={addUserAVUMutation.isPending}
              isLoading={userAVUQuery.isLoading}
              isSaving={updateUserAVUMutation.isPending}
              onCancel={cancelUserAVUEditor}
              onChange={setUserAVUForm}
              onDelete={beginUserAVUDelete}
              onEdit={beginUserAVUEdit}
              onSubmitAdd={submitUserAVUAdd}
              onSubmitEdit={submitUserAVUUpdate}
            />
          )}

          <Group justify="flex-end">
            <Button variant="default" onClick={closeUserMetadata}>
              Close
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(deletingUser)}
        onClose={() => {
          if (!deleteUserMutation.isPending) {
            setDeletingUser(null)
          }
        }}
        title={deletingUser ? `Delete ${deletingUser.name}` : 'Delete user'}
        centered
      >
        <Stack gap="md">
          {deleteUserMutation.isError ? (
            <Alert color="red" variant="light" title="Unable to delete user">
              {userMutationErrorMessage(deleteUserMutation.error, 'delete')}
            </Alert>
          ) : null}
          <Text>
            Delete this iRODS user from zone <Text span fw={700}>{deletingUser?.zone}</Text>?
          </Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setDeletingUser(null)}
              disabled={deleteUserMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              color="red"
              leftSection={<IconTrash size={16} />}
              loading={deleteUserMutation.isPending}
              onClick={() => deleteUserMutation.mutate()}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={createGroupOpened}
        onClose={() => {
          if (!createGroupMutation.isPending) {
            setCreateGroupOpened(false)
          }
        }}
        title="Create group"
        centered
      >
        <Stack gap="md">
          {createGroupMutation.isError ? (
            <Alert color="red" variant="light" title="Unable to create group">
              {groupMutationErrorMessage(createGroupMutation.error, 'create')}
            </Alert>
          ) : null}
          <TextInput
            label="Name"
            value={createGroupName}
            onChange={(event) => setCreateGroupName(event.currentTarget.value)}
          />
          <TextInput
            label="Zone"
            placeholder="Default zone"
            value={createGroupZone}
            onChange={(event) => setCreateGroupZone(event.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setCreateGroupOpened(false)}
              disabled={createGroupMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              loading={createGroupMutation.isPending}
              disabled={!createGroupName.trim()}
              onClick={() => createGroupMutation.mutate()}
            >
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(selectedGroup)}
        onClose={closeGroupDetails}
        title={selectedGroup ? selectedGroup.name : 'Group details'}
        centered
        size="lg"
      >
        <Stack gap="md">
          {selectedGroupQuery.isLoading ? (
            <Group justify="center" py="md">
              <Loader size="sm" />
            </Group>
          ) : null}

          {selectedGroupQuery.isError ? (
            <Alert
              color={errorColor(selectedGroupQuery.error)}
              variant="light"
              title={errorTitle(selectedGroupQuery.error)}
            >
              {errorMessage(selectedGroupQuery.error)}
            </Alert>
          ) : null}

          {addMemberMutation.isError ? (
            <Alert color="red" variant="light" title="Unable to add member">
              {groupMutationErrorMessage(addMemberMutation.error, 'add-member')}
            </Alert>
          ) : null}

          {selectedGroupQuery.data &&
          isCurrentGroupadmin &&
          !isCurrentRodsadmin &&
          !canManageSelectedGroupMembers ? (
            <Alert color="yellow" variant="light" title="Membership required">
              Add your own account to this group before managing other members.
            </Alert>
          ) : null}

          {groupadminNeedsSelfMembership ? (
            <Alert color="blue" variant="light" title="Add yourself first">
              Add your own account to this empty group before adding other members.
            </Alert>
          ) : null}

          {selectedGroupQuery.data ? (
            <Stack gap="md">
              <Group gap="xs">
                <Badge variant="light" color="cyan">
                  {selectedGroupQuery.data.group.zone}
                </Badge>
                <Badge variant="light" color="gray">
                  {selectedGroupQuery.data.group.members?.length ?? 0} members
                </Badge>
              </Group>

              <Tabs defaultValue="members">
                <Tabs.List>
                  <Tabs.Tab value="members">Members</Tabs.Tab>
                  <Tabs.Tab value="avus">AVUs</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="members" pt="md">
                  <Stack gap="md">
                    {canManageSelectedGroupMembers ? (
                      <Group align="flex-end">
                        <Autocomplete
                          label="Add member"
                          placeholder="Username or username#zone"
                          value={addMemberName}
                          data={memberOptions}
                          disabled={groupadminNeedsSelfMembership}
                          onChange={setMemberName}
                        />
                        <Button
                          leftSection={<IconPlus size={16} />}
                          loading={addMemberMutation.isPending}
                          disabled={!addMemberName.trim()}
                          onClick={() => addMemberMutation.mutate()}
                        >
                          Add
                        </Button>
                      </Group>
                    ) : null}

                    <Table highlightOnHover verticalSpacing="sm">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Member</Table.Th>
                          <Table.Th>Type</Table.Th>
                          <Table.Th>Zone</Table.Th>
                          {canManageSelectedGroupMembers ? <Table.Th>Actions</Table.Th> : null}
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {(selectedGroupQuery.data.group.members ?? []).length === 0 ? (
                          <Table.Tr>
                            <Table.Td colSpan={canManageSelectedGroupMembers ? 4 : 3}>
                              <Text size="sm" c="dimmed">
                                No members returned.
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        ) : (
                          (selectedGroupQuery.data.group.members ?? []).map((member) => (
                            <Table.Tr key={`${member.zone}:${member.name}`}>
                              <Table.Td>{member.name}</Table.Td>
                              <Table.Td>{member.type}</Table.Td>
                              <Table.Td>{member.zone}</Table.Td>
                              {canManageSelectedGroupMembers ? (
                                <Table.Td>
                                  <ActionIcon
                                    variant="subtle"
                                    color="red"
                                    aria-label={`Remove ${member.name} from ${selectedGroup?.name}`}
                                    disabled={removeMemberMutation.isPending}
                                    onClick={() => openRemoveMember(member)}
                                  >
                                    <IconTrash size={16} />
                                  </ActionIcon>
                                </Table.Td>
                              ) : null}
                            </Table.Tr>
                          ))
                        )}
                      </Table.Tbody>
                    </Table>
                  </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="avus" pt="md">
                  <Stack gap="md">
                    <Group gap="xs" justify="space-between">
                      <Group gap="xs">
                        <ThemeIcon variant="light" color="orange" size="md">
                          <IconDatabase size={14} />
                        </ThemeIcon>
                        <Title order={4}>AVU Metadata</Title>
                      </Group>
                      {groupAVUQuery.data?.links?.create ? (
                        <Button
                          size="xs"
                          variant="light"
                          leftSection={<IconPlus size={14} />}
                          loading={addGroupAVUMutation.isPending}
                          onClick={beginGroupAVUAdd}
                          disabled={isAddingGroupAVU}
                        >
                          Add AVU
                        </Button>
                      ) : null}
                    </Group>

                    {groupAVUQuery.isError ? (
                      <Alert
                        color={errorColor(groupAVUQuery.error)}
                        variant="light"
                        icon={<IconAlertCircle size={18} />}
                        title="Unable to load group AVUs"
                      >
                        {errorMessage(groupAVUQuery.error)}
                      </Alert>
                    ) : (
                      <AVUMetadataTable
                        avus={groupAVUQuery.data?.avus}
                        editingAVUId={editingGroupAVU?.id}
                        form={groupAVUForm}
                        isAdding={isAddingGroupAVU}
                        isCreating={addGroupAVUMutation.isPending}
                        isLoading={groupAVUQuery.isLoading}
                        isSaving={updateGroupAVUMutation.isPending}
                        onCancel={cancelGroupAVUEditor}
                        onChange={setGroupAVUForm}
                        onDelete={beginGroupAVUDelete}
                        onEdit={beginGroupAVUEdit}
                        onSubmitAdd={submitGroupAVUAdd}
                        onSubmitEdit={submitGroupAVUUpdate}
                      />
                    )}
                  </Stack>
                </Tabs.Panel>
              </Tabs>
            </Stack>
          ) : null}

          <Group justify="flex-end">
            <Button variant="default" onClick={closeGroupDetails}>
              Close
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(removingMember)}
        onClose={() => {
          if (!removeMemberMutation.isPending) {
            setRemovingMember(null)
          }
        }}
        title="Remove member"
        centered
      >
        <Stack gap="md">
          {removeMemberMutation.isError ? (
            <Alert color="red" variant="light" title="Unable to remove member">
              {groupMutationErrorMessage(removeMemberMutation.error, 'remove-member')}
            </Alert>
          ) : null}
          <Text>
            Remove <Text span fw={700}>{removingMember?.name}</Text> from{' '}
            <Text span fw={700}>{selectedGroup?.name}</Text>?
          </Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setRemovingMember(null)}
              disabled={removeMemberMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              color="red"
              leftSection={<IconTrash size={16} />}
              loading={removeMemberMutation.isPending}
              disabled={!removingMember}
              onClick={() => {
                if (removingMember) {
                  removeMemberMutation.mutate(removingMember)
                }
              }}
            >
              Remove
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(deletingGroup)}
        onClose={() => {
          if (!deleteGroupMutation.isPending) {
            setDeletingGroup(null)
          }
        }}
        title={deletingGroup ? `Delete ${deletingGroup.name}` : 'Delete group'}
        centered
      >
        <Stack gap="md">
          {deleteGroupMutation.isError ? (
            <Alert color="red" variant="light" title="Unable to delete group">
              {groupMutationErrorMessage(deleteGroupMutation.error, 'delete')}
            </Alert>
          ) : null}
          <Text>
            Delete this iRODS group from zone <Text span fw={700}>{deletingGroup?.zone}</Text>?
          </Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setDeletingGroup(null)}
              disabled={deleteGroupMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              color="red"
              leftSection={<IconTrash size={16} />}
              loading={deleteGroupMutation.isPending}
              onClick={() => deleteGroupMutation.mutate()}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Card shadow="sm" radius="xl" padding="lg">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2}>Users & Groups</Title>
            <Text c="dimmed">
              Browse iRODS users, groups, and membership summaries visible to this session.
            </Text>
          </div>
          <Group gap="xs">
            {usersQuery.data ? (
              <Badge variant="light" color="blue">
                {usersQuery.data.count} users
              </Badge>
            ) : null}
            {groupsQuery.data ? (
              <Badge variant="light" color="cyan">
                {groupsQuery.data.count} groups
              </Badge>
            ) : null}
          </Group>
          {canCreateUsers ? (
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => {
                createUserMutation.reset()
                setCreateType('rodsuser')
                setCreateOpened(true)
              }}
            >
              Create user
            </Button>
          ) : null}
          {canManageGroups ? (
            <Button
              variant="light"
              leftSection={<IconPlus size={16} />}
              onClick={() => {
                createGroupMutation.reset()
                setCreateGroupOpened(true)
              }}
            >
              Create group
            </Button>
          ) : null}
        </Group>
      </Card>

      <Card shadow="sm" radius="xl" padding="lg">
        <Stack gap="md">
          <Group align="flex-end">
            <TextInput
              label="Zone"
              placeholder="Default zone"
              value={zone}
              onChange={(event) => setZone(event.currentTarget.value)}
            />
            <TextInput
              label="Prefix"
              placeholder="At least 3 characters"
              value={prefix}
              onChange={(event) => setPrefix(event.currentTarget.value)}
              description={
                prefix.trim().length > 0 && prefix.trim().length < 3
                  ? 'Prefix filtering starts at 3 characters.'
                  : undefined
              }
            />
          </Group>

          <Tabs defaultValue="users" keepMounted={false}>
            <Tabs.List>
              <Tabs.Tab value="users">Users</Tabs.Tab>
              <Tabs.Tab value="groups">Groups</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="users" pt="md">
              <UsersTable
                query={usersQuery}
                onViewMetadata={openUserMetadata}
                onEditUser={openEditUser}
                onDeleteUser={openDeleteUser}
                canEditUsers={canEditUsers}
                canDeleteUsers={canDeleteUsers}
                actionDisabled={
                  updateUserMutation.isPending || deleteUserMutation.isPending
                }
              />
            </Tabs.Panel>

            <Tabs.Panel value="groups" pt="md">
              <GroupsTable
                query={groupsQuery}
                onViewGroup={openGroupDetails}
                onDeleteGroup={openDeleteGroup}
                canDeleteGroups={canDeleteGroups}
                actionDisabled={deleteGroupMutation.isPending}
              />
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </Card>
    </Stack>
  )
}

function UsersTable({
  query,
  onViewMetadata,
  onEditUser,
  onDeleteUser,
  canEditUsers,
  canDeleteUsers,
  actionDisabled,
}: {
  query: UseQueryResult<Awaited<ReturnType<typeof getUserMembershipSummaries>>, Error>
  onViewMetadata: (user: UserMembershipSummary) => void
  onEditUser: (user: UserMembershipSummary) => void
  onDeleteUser: (user: UserMembershipSummary) => void
  canEditUsers: boolean
  canDeleteUsers: boolean
  actionDisabled: boolean
}) {
  if (query.isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    )
  }

  if (query.isError) {
    return (
      <Alert
        color={errorColor(query.error)}
        variant="light"
        icon={<IconAlertCircle size={18} />}
        title={errorTitle(query.error)}
      >
        {errorMessage(query.error)}
      </Alert>
    )
  }

  if (!query.data) {
    return null
  }

  return (
    <Table highlightOnHover verticalSpacing="sm">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>User</Table.Th>
          <Table.Th>Type</Table.Th>
          <Table.Th>Zone</Table.Th>
          <Table.Th>Groups</Table.Th>
          <Table.Th>Actions</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {query.data.users.length === 0 ? (
          <Table.Tr>
            <Table.Td colSpan={5}>
              <Text size="sm" c="dimmed">
                No users returned.
              </Text>
            </Table.Td>
          </Table.Tr>
        ) : (
          query.data.users.map((user) => (
            <Table.Tr key={`${user.zone}:${user.name}`}>
              <Table.Td>
                <Group gap="sm" wrap="nowrap">
                  <ThemeIcon variant="light" color="blue" size="md">
                    <IconUser size={16} />
                  </ThemeIcon>
                  <div>
                    <Text fw={600}>{user.name}</Text>
                    <Text size="xs" c="dimmed">
                      ID {user.id}
                    </Text>
                  </div>
                </Group>
              </Table.Td>
              <Table.Td>{user.type}</Table.Td>
              <Table.Td>{user.zone}</Table.Td>
              <Table.Td>
                {user.groups.length > 0 ? (
                  <Group gap={4}>
                    {user.groups.map((group) => (
                      <Badge key={`${group.zone}:${group.name}`} variant="light" color="gray">
                        {group.name}
                      </Badge>
                    ))}
                  </Group>
                ) : (
                  <Text size="sm" c="dimmed">
                    No groups
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                <Group gap="xs" wrap="nowrap">
                  <ActionIcon
                    variant="subtle"
                    aria-label={`View metadata for ${user.name}`}
                    onClick={() => onViewMetadata(user)}
                  >
                    <IconDatabase size={16} />
                  </ActionIcon>
                  {canEditUsers ? (
                    <ActionIcon
                      variant="subtle"
                      aria-label={`Edit ${user.name}`}
                      disabled={actionDisabled}
                      onClick={() => onEditUser(user)}
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                  ) : null}
                  {canDeleteUsers ? (
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label={`Delete ${user.name}`}
                      disabled={actionDisabled}
                      onClick={() => onDeleteUser(user)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  ) : null}
                </Group>
              </Table.Td>
            </Table.Tr>
          ))
        )}
      </Table.Tbody>
    </Table>
  )
}

function GroupsTable({
  query,
  onViewGroup,
  onDeleteGroup,
  canDeleteGroups,
  actionDisabled,
}: {
  query: UseQueryResult<Awaited<ReturnType<typeof getUserGroupSummaries>>, Error>
  onViewGroup: (group: UserGroupSummary) => void
  onDeleteGroup: (group: UserGroupSummary) => void
  canDeleteGroups: boolean
  actionDisabled: boolean
}) {
  if (query.isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    )
  }

  if (query.isError) {
    return (
      <Alert
        color={errorColor(query.error)}
        variant="light"
        icon={<IconAlertCircle size={18} />}
        title={errorTitle(query.error)}
      >
        {errorMessage(query.error)}
      </Alert>
    )
  }

  if (!query.data) {
    return null
  }

  return (
    <Table highlightOnHover verticalSpacing="sm">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Group</Table.Th>
          <Table.Th>Zone</Table.Th>
          <Table.Th>Members</Table.Th>
          <Table.Th>Actions</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {query.data.groups.length === 0 ? (
          <Table.Tr>
            <Table.Td colSpan={4}>
              <Text size="sm" c="dimmed">
                No groups returned.
              </Text>
            </Table.Td>
          </Table.Tr>
        ) : (
          query.data.groups.map((group) => (
            <Table.Tr key={`${group.zone}:${group.name}`}>
              <Table.Td>
                <Group gap="sm" wrap="nowrap">
                  <ThemeIcon variant="light" color="cyan" size="md">
                    <IconUsersGroup size={16} />
                  </ThemeIcon>
                  <div>
                    <Text fw={600}>{group.name}</Text>
                    <Text size="xs" c="dimmed">
                      {group.type}
                    </Text>
                  </div>
                </Group>
              </Table.Td>
              <Table.Td>{group.zone}</Table.Td>
              <Table.Td>{group.member_count}</Table.Td>
              <Table.Td>
                <Group gap="xs" wrap="nowrap">
                  <ActionIcon
                    variant="subtle"
                    aria-label={`View ${group.name}`}
                    onClick={() => onViewGroup(group)}
                  >
                    <IconListDetails size={16} />
                  </ActionIcon>
                  {canDeleteGroups ? (
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label={`Delete ${group.name}`}
                      disabled={actionDisabled}
                      onClick={() => onDeleteGroup(group)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  ) : null}
                </Group>
              </Table.Td>
            </Table.Tr>
          ))
        )}
      </Table.Tbody>
    </Table>
  )
}
