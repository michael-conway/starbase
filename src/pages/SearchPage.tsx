import { Alert, Badge, Card, Grid, Stack, Text, TextInput, Title } from '@mantine/core'

export function SearchPage() {
  return (
    <Stack gap="lg">
      <div>
        <Badge variant="light" color="cyan">
          Search
        </Badge>
        <Title order={1} mt="sm">
          Search should be its own major view.
        </Title>
        <Text c="dimmed" maw={760}>
          Keep search separate from explorer navigation so rich filtering,
          result grids, saved searches, and metadata search do not distort the
          file browser.
        </Text>
      </div>

      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Card radius="xl" shadow="sm" padding="lg">
            <Stack gap="md">
              <Title order={3}>Starter direction</Title>
              <TextInput label="Search query" placeholder="filename, AVU metadata, path prefix, owner..." />
              <Alert variant="light" color="blue" title="Next implementation slice">
                Add query composition, result ranking, and result actions here
                without overloading the file explorer.
              </Alert>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  )
}
