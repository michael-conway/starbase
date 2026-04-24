import { Alert, Badge, Card, Grid, Stack, Text, Textarea, Title } from '@mantine/core'

export function RulesPage() {
  return (
    <Stack gap="lg">
      <div>
        <Badge variant="light" color="cyan">
          Rules
        </Badge>
        <Title order={1} mt="sm">
          Rule execution belongs in a dedicated operator workspace.
        </Title>
        <Text c="dimmed" maw={760}>
          This area can grow into rule templates, execution history, parameter
          forms, and diagnostics without leaking that complexity into the browser.
        </Text>
      </div>

      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Card radius="xl" shadow="sm" padding="lg">
            <Stack gap="md">
              <Title order={3}>Starter direction</Title>
              <Textarea
                minRows={8}
                label="Rule body"
                placeholder="Add rule text or parameterized templates here"
              />
              <Alert variant="light" color="blue" title="Future capability">
                Treat rules as a first-class app surface with auditability and
                explicit execution controls.
              </Alert>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  )
}
