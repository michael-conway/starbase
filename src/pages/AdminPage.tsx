import { Alert, Badge, Card, Grid, Group, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import {
  IconServerCog,
  IconShieldHalfFilled,
  IconUsersGroup,
} from '@tabler/icons-react'

export function AdminPage() {
  return (
    <Stack gap="lg">
      <div>
        <Badge variant="light" color="cyan">
          Admin
        </Badge>
        <Title order={1} mt="sm">
          Keep administration on its own branch of the app.
        </Title>
        <Text c="dimmed" maw={760}>
          Administrative tools tend to expand into user management, ACLs,
          resources, quotas, policies, and system diagnostics. The starter makes
          that separation explicit now.
        </Text>
      </div>

      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 4 }}>
          <AdminCard
            icon={IconUsersGroup}
            title="Users and groups"
            text="User lifecycle, group membership, and impersonation-sensitive tools."
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <AdminCard
            icon={IconShieldHalfFilled}
            title="Policies and ACLs"
            text="Access review, metadata policy, and privilege-aware changes."
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <AdminCard
            icon={IconServerCog}
            title="Resources and diagnostics"
            text="Server-side health, resources, storage topology, and operational checks."
          />
        </Grid.Col>
      </Grid>

      <Alert variant="light" color="blue" title="Starter direction">
        Admin pages should not inherit the same interaction density or task model
        as the file browser. Separate routes keep that boundary clean.
      </Alert>
    </Stack>
  )
}

function AdminCard({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof IconUsersGroup
  title: string
  text: string
}) {
  return (
    <Card radius="xl" shadow="sm" padding="lg">
      <Stack gap="sm">
        <Group gap="sm">
          <ThemeIcon variant="light" color="cyan">
            <Icon size={18} />
          </ThemeIcon>
          <Text fw={700}>{title}</Text>
        </Group>
        <Text size="sm" c="dimmed">
          {text}
        </Text>
      </Stack>
    </Card>
  )
}
