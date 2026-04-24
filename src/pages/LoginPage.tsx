import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Container,
  Grid,
  Group,
  PasswordInput,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import {
  IconFolders,
  IconKey,
  IconLock,
  IconRoute,
  IconUpload,
} from '@tabler/icons-react'
import type { AuthMode } from '../lib/irods-rest'
import { useSession } from '../providers/session'

export function LoginPage() {
  const {
    isAuthenticated,
    preferences,
    signInBasic,
    signInOidc,
    setPreferredAuthMode,
  } = useSession()
  const [mode, setMode] = useState<AuthMode>(preferences.authMode)
  const [baseUrl, setBaseUrl] = useState(preferences.baseUrl)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')

  if (isAuthenticated) {
    return <Navigate to="/app/explorer" replace />
  }

  return (
    <Container size="xl" py={48}>
      <Stack gap="xl">
        <PaperHero />

        <Grid gap="lg">
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Card radius="xl" padding="xl" shadow="sm">
              <Stack gap="lg">
                <div>
                  <Badge variant="filled" color="dark">
                    Sign in
                  </Badge>
                  <Title order={1} mt="sm">
                    Open Starbase directly into the browser experience.
                  </Title>
                  <Text c="dimmed" mt="sm">
                    The first page should do three things well: explain the app,
                    let the operator authenticate, and move straight into a clean
                    file and collection workspace.
                  </Text>
                </div>

                <SegmentedControl
                  fullWidth
                  value={mode}
                  onChange={(value) => {
                    const next = value as AuthMode
                    setMode(next)
                    setPreferredAuthMode(next)
                  }}
                  data={[
                    { label: 'Basic auth', value: 'basic' },
                    { label: 'OIDC', value: 'oidc' },
                  ]}
                />

                <TextInput
                  label="API base URL"
                  placeholder="Use dev proxy when blank"
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.currentTarget.value)}
                />

                {mode === 'basic' ? (
                  <Stack gap="md">
                    <TextInput
                      label="Username"
                      placeholder="rods"
                      value={username}
                      onChange={(event) => setUsername(event.currentTarget.value)}
                    />
                    <PasswordInput
                      label="Password"
                      placeholder="Enter the iRODS or service password"
                      value={password}
                      onChange={(event) => setPassword(event.currentTarget.value)}
                    />
                    <Button
                      leftSection={<IconLock size={16} />}
                      onClick={() =>
                        signInBasic({
                          username,
                          password,
                          baseUrl,
                        })
                      }
                    >
                      Enter workspace
                    </Button>
                    <Alert variant="light" color="blue" title="Basic auth">
                      This is the most direct local development path because
                      `irods-go-rest` already accepts `Authorization: Basic`.
                    </Alert>
                  </Stack>
                ) : (
                  <Stack gap="md">
                    <Alert variant="light" color="blue" title="OIDC flow">
                      `irods-go-rest` owns the browser login flow under `/web`.
                      Open that flow, complete Keycloak login, then paste the
                      resulting access token here until the backend exposes a
                      session introspection endpoint for the SPA.
                    </Alert>

                    <Group>
                      <Button
                        component="a"
                        href={`${baseUrl.trim() || ''}/web/login`}
                        target="_blank"
                        leftSection={<IconKey size={16} />}
                      >
                        Open Keycloak login
                      </Button>
                      <Anchor href="/setup">
                        View setup notes
                      </Anchor>
                    </Group>

                    <PasswordInput
                      label="Access token"
                      placeholder="Paste the bearer token from the backend web session page"
                      value={token}
                      onChange={(event) => setToken(event.currentTarget.value)}
                    />

                    <Button
                      variant="filled"
                      onClick={() =>
                        signInOidc({
                          token,
                          baseUrl,
                        })
                      }
                    >
                      Enter workspace
                    </Button>
                  </Stack>
                )}
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 5 }}>
            <Stack gap="lg">
              <SectionCard
                icon={IconFolders}
                title="Explorer first"
                text="Drive-style file browsing, collection management, object details, and clear path navigation."
              />
              <SectionCard
                icon={IconUpload}
                title="Transfer workflows"
                text="Uploads, downloads, and replacement flows should feel like primary browser actions, not admin tasks."
              />
              <SectionCard
                icon={IconRoute}
                title="Path-oriented backend"
                text="The frontend follows the current path-first `irods-go-rest` contract so browsing stays aligned with the API."
              />
            </Stack>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  )
}

function PaperHero() {
  return (
    <Card radius="xl" padding="xl" className="hero-panel" shadow="sm">
      <Group justify="space-between" align="flex-start" gap="xl">
        <div>
          <Badge variant="light" color="cyan">
            iRODS browser starter
          </Badge>
          <Title order={2} mt="sm">
            Starbase is the SPA shell for everyday iRODS browsing and file work.
          </Title>
          <Text c="dimmed" mt="sm" maw={760}>
            The initial product should feel coherent on first open: authenticate,
            land in the explorer, and start working with collections and objects
            without being distracted by unfinished secondary areas.
          </Text>
        </div>
      </Group>
    </Card>
  )
}

function SectionCard({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof IconFolders
  title: string
  text: string
}) {
  return (
    <Card radius="xl" padding="lg" shadow="sm">
      <Group align="flex-start" wrap="nowrap">
        <Icon size={20} />
        <div>
          <Text fw={700}>{title}</Text>
          <Text size="sm" c="dimmed">
            {text}
          </Text>
        </div>
      </Group>
    </Card>
  )
}
