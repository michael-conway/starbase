import { useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Code,
  Grid,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  IconAlertCircle,
  IconCopy,
  IconKey,
  IconRefresh,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react'
import { currentSessionUserName } from '../features/identity'
import {
  ApiError,
  deleteS3UserSecret,
  getS3UserSecret,
  storeS3UserSecret,
} from '../lib/irods-rest'
import { useAppConfig } from '../providers/use-app-config'
import { useSession } from '../providers/use-session'

const s3SecretKeyPattern = /^[A-Za-z0-9/+._\-~]{40}$/

function validateS3SecretKey(secretKey: string) {
  const normalized = secretKey.trim()
  if (!normalized) {
    return 'Secret key is required.'
  }

  if (!s3SecretKeyPattern.test(normalized)) {
    return 'Secret key must be 40 characters using A-Z, a-z, 0-9, /, +, ., _, -, or ~.'
  }

  return ''
}

function s3SecretError(error: Error) {
  if (error instanceof ApiError) {
    if (error.status === 501) {
      return {
        title: 'S3 API unavailable',
        message: 'This backend does not support iRODS S3 API administration.',
      }
    }

    if (error.status === 503) {
      return {
        title: 'S3 user secrets are not configured',
        message: 'The backend is missing S3UserMappingFile configuration.',
      }
    }

    if (error.status === 403) {
      return {
        title: 'S3 secret access denied',
        message: error.message,
      }
    }
  }

  return {
    title: 'Unable to load S3 secret',
    message: error.message,
  }
}

export function SettingsPage() {
  const appConfig = useAppConfig()
  const { basicUsername, connection, oidcToken } = useSession()
  const resolvedRestApiBaseUrl = connection.baseUrl.trim() || 'Relative to Starbase origin'
  const s3AdminEnabled = appConfig.config.s3AdminEnabled
  const userName = useMemo(
    () =>
      currentSessionUserName({
        authMode: connection.auth.mode,
        basicUsername,
        oidcToken,
      }),
    [basicUsername, connection.auth.mode, oidcToken],
  )
  const [secretDraft, setSecretDraft] = useState({
    sourceSecretKey: '',
    value: '',
  })

  const s3SecretQuery = useQuery({
    queryKey: ['s3-user-secret', userName, connection, s3AdminEnabled],
    queryFn: async () => {
      try {
        return (await getS3UserSecret(userName, connection.auth, connection.baseUrl)).user_secret
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return null
        }

        throw error
      }
    },
    enabled: Boolean(s3AdminEnabled && userName),
    retry: false,
  })

  const loadedSecretKey = s3SecretQuery.data?.secret_key ?? ''
  const secretKey =
    secretDraft.sourceSecretKey === loadedSecretKey ? secretDraft.value : loadedSecretKey

  const setSecretKey = (value: string) => {
    setSecretDraft({
      sourceSecretKey: loadedSecretKey,
      value,
    })
  }

  const updateSecretMutation = useMutation({
    mutationFn: (input: { secretKey: string; method: 'POST' | 'PUT' }) =>
      storeS3UserSecret(
        {
          user_name: userName,
          secret_key: input.secretKey,
        },
        connection.auth,
        connection.baseUrl,
        input.method,
      ),
    onSuccess: async (payload) => {
      const nextSecretKey = payload.user_secret.secret_key ?? ''
      setSecretDraft({
        sourceSecretKey: nextSecretKey,
        value: nextSecretKey,
      })
      notifications.show({
        title: 'S3 secret saved',
        message: userName,
        color: 'teal',
      })
      await s3SecretQuery.refetch()
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'S3 secret update failed',
        message: error.message,
        color: 'red',
      })
    },
  })

  const regenerateSecretMutation = useMutation({
    mutationFn: () =>
      storeS3UserSecret(
        {
          user_name: userName,
          auto_generate: true,
        },
        connection.auth,
        connection.baseUrl,
        'PUT',
      ),
    onSuccess: async (payload) => {
      const nextSecretKey = payload.user_secret.secret_key ?? ''
      setSecretDraft({
        sourceSecretKey: nextSecretKey,
        value: nextSecretKey,
      })
      notifications.show({
        title: 'S3 secret regenerated',
        message: userName,
        color: 'teal',
      })
      await s3SecretQuery.refetch()
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'S3 secret regeneration failed',
        message: error.message,
        color: 'red',
      })
    },
  })

  const deleteSecretMutation = useMutation({
    mutationFn: () => deleteS3UserSecret(userName, connection.auth, connection.baseUrl),
    onSuccess: async () => {
      setSecretDraft({
        sourceSecretKey: '',
        value: '',
      })
      notifications.show({
        title: 'S3 secret deleted',
        message: userName,
        color: 'teal',
      })
      await s3SecretQuery.refetch()
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'S3 secret delete failed',
        message: error.message,
        color: 'red',
      })
    },
  })

  const copySecretKey = async () => {
    if (!secretKey.trim()) {
      return
    }

    try {
      await navigator.clipboard.writeText(secretKey.trim())
      notifications.show({
        title: 'S3 secret copied',
        message: userName,
        color: 'teal',
      })
    } catch {
      notifications.show({
        title: 'Copy failed',
        message: 'Clipboard access was blocked.',
        color: 'red',
      })
    }
  }

  const submitSecretUpdate = () => {
    const validationError = validateS3SecretKey(secretKey)
    if (validationError) {
      notifications.show({
        title: 'Invalid S3 secret key',
        message: validationError,
        color: 'red',
      })
      return
    }

    updateSecretMutation.mutate({
      secretKey: secretKey.trim(),
      method: s3SecretQuery.data ? 'PUT' : 'POST',
    })
  }

  const submitSecretDelete = () => {
    if (!s3SecretQuery.data) {
      return
    }

    const confirmed = window.confirm(`Delete S3 API secret key for ${userName}?`)
    if (!confirmed) {
      return
    }

    deleteSecretMutation.mutate()
  }

  const secretError = s3SecretQuery.error ? s3SecretError(s3SecretQuery.error) : null
  const isBusy =
    updateSecretMutation.isPending ||
    regenerateSecretMutation.isPending ||
    deleteSecretMutation.isPending

  return (
    <Stack gap="lg">
      <Card shadow="sm" radius="xl" padding="lg">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2}>Settings</Title>
            <Text c="dimmed">User and tool settings for this Starbase session.</Text>
          </div>
        </Group>
      </Card>

      {s3AdminEnabled ? (
        <Card shadow="sm" radius="xl" padding="lg">
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <Group gap="sm" align="flex-start">
                <ThemeIcon variant="light" color="cyan" size="lg">
                  <IconKey size={18} />
                </ThemeIcon>
                <div>
                  <Title order={3}>S3 API Secret Key</Title>
                  <Text size="sm" c="dimmed">
                    Access key ID: <Code>{userName || 'Unavailable'}</Code>
                  </Text>
                </div>
              </Group>
              {s3SecretQuery.isSuccess ? (
                <Badge variant="light" color={s3SecretQuery.data ? 'teal' : 'gray'}>
                  {s3SecretQuery.data ? 'Configured' : 'Not configured'}
                </Badge>
              ) : null}
            </Group>

            {!userName ? (
              <Alert
                color="red"
                variant="light"
                icon={<IconAlertCircle size={18} />}
                title="Unable to resolve iRODS user"
              >
                Sign in with an iRODS username or an OIDC token containing an iRODS user claim.
              </Alert>
            ) : null}

            {s3SecretQuery.isLoading ? (
              <Group justify="center" py="md">
                <Loader size="sm" />
              </Group>
            ) : null}

            {secretError ? (
              <Alert
                color="red"
                variant="light"
                icon={<IconAlertCircle size={18} />}
                title={secretError.title}
              >
                {secretError.message}
              </Alert>
            ) : null}

            <TextInput
              label="Secret key"
              value={secretKey}
              onChange={(event) => setSecretKey(event.currentTarget.value)}
              disabled={!userName || s3SecretQuery.isLoading || Boolean(secretError) || isBusy}
              placeholder="40-character S3 secret key"
              spellCheck={false}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  submitSecretUpdate()
                }
              }}
            />

            {s3SecretQuery.data?.irods_path ? (
              <Text size="sm" c="dimmed">
                Stored at <Code>{s3SecretQuery.data.irods_path}</Code>
              </Text>
            ) : null}

            <Group justify="flex-end">
              <Button
                variant="default"
                leftSection={<IconCopy size={16} />}
                onClick={() => void copySecretKey()}
                disabled={!secretKey.trim() || isBusy}
              >
                Copy
              </Button>
              <Button
                variant="light"
                leftSection={<IconRefresh size={16} />}
                onClick={() => regenerateSecretMutation.mutate()}
                loading={regenerateSecretMutation.isPending}
                disabled={!userName || Boolean(secretError) || updateSecretMutation.isPending}
              >
                Regenerate
              </Button>
              <Button
                leftSection={<IconUpload size={16} />}
                onClick={submitSecretUpdate}
                loading={updateSecretMutation.isPending}
                disabled={!userName || Boolean(secretError) || regenerateSecretMutation.isPending}
              >
                Update
              </Button>
              <Button
                color="red"
                variant="light"
                leftSection={<IconTrash size={16} />}
                onClick={submitSecretDelete}
                loading={deleteSecretMutation.isPending}
                disabled={!s3SecretQuery.data || Boolean(secretError) || isBusy}
              >
                Delete
              </Button>
            </Group>
          </Stack>
        </Card>
      ) : null}

      {!s3AdminEnabled ? (
        <Alert variant="light" color="gray" title="No enabled settings">
          Settings sections are controlled by Starbase runtime configuration.
        </Alert>
      ) : null}

      <Alert
        color={appConfig.error ? 'yellow' : 'blue'}
        variant="light"
        title={appConfig.error ? 'Startup config fallback' : 'Startup config'}
      >
        <Grid gap="xs" align="center">
          <Grid.Col span={4}>
            <Text size="sm" c="dimmed">
              Source
            </Text>
          </Grid.Col>
          <Grid.Col span={8}>
            <Code>{appConfig.configPath}</Code>
          </Grid.Col>
          <Grid.Col span={4}>
            <Text size="sm" c="dimmed">
              REST API
            </Text>
          </Grid.Col>
          <Grid.Col span={8}>
            <Code>{resolvedRestApiBaseUrl}</Code>
          </Grid.Col>
          <Grid.Col span={4}>
            <Text size="sm" c="dimmed">
              S3 bucket support
            </Text>
          </Grid.Col>
          <Grid.Col span={8}>
            <Badge variant="light" color={appConfig.config.s3AdminEnabled ? 'teal' : 'gray'}>
              {appConfig.config.s3AdminEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </Grid.Col>
          <Grid.Col span={4}>
            <Text size="sm" c="dimmed">
              Users & Groups admin
            </Text>
          </Grid.Col>
          <Grid.Col span={8}>
            <Badge variant="light" color={appConfig.config.userGroupAdminEnabled ? 'teal' : 'gray'}>
              {appConfig.config.userGroupAdminEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </Grid.Col>
        </Grid>
        {appConfig.error ? (
          <Text size="sm" mt={4}>
            {appConfig.error}
          </Text>
        ) : null}
      </Alert>
    </Stack>
  )
}
