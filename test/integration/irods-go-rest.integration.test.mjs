import assert from 'node:assert/strict'
import test from 'node:test'

const integrationEnabledEnvVar = 'STARBASE_INTEGRATION'
const baseUrlEnvVar = 'STARBASE_TEST_BASE_URL'
const tokenEnvVar = 'STARBASE_TEST_BEARER_TOKEN'
const objectIdEnvVar = 'STARBASE_TEST_OBJECT_ID'
const collectionIdEnvVar = 'STARBASE_TEST_COLLECTION_ID'

function envValue(name) {
  return process.env[name]?.trim() ?? ''
}

function isIntegrationEnabled() {
  return /^(1|true|yes)$/i.test(envValue(integrationEnabledEnvVar))
}

function integrationBaseUrl() {
  return (envValue(baseUrlEnvVar) || 'http://localhost:8080').replace(/\/$/, '')
}

function hasRequiredObjectLookupEnv() {
  return Boolean(envValue(tokenEnvVar) && envValue(objectIdEnvVar))
}

function hasRequiredCollectionLookupEnv() {
  return Boolean(envValue(tokenEnvVar) && envValue(collectionIdEnvVar))
}

async function requestJson(path, token) {
  const response = await fetch(`${integrationBaseUrl()}${path}`, {
    headers: token
      ? {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        }
      : {
          Accept: 'application/json',
        },
  })

  const bodyText = await response.text()
  let payload = null

  try {
    payload = bodyText ? JSON.parse(bodyText) : null
  } catch {
    payload = bodyText
  }

  return { response, payload }
}

test('health endpoint responds for a running irods-go-rest service', {
  skip: !isIntegrationEnabled(),
}, async () => {
  const { response, payload } = await requestJson('/healthz')

  assert.equal(response.status, 200, `expected 200 from /healthz, got ${response.status}`)
  assert.equal(typeof payload, 'object')
  assert.ok(payload)
  assert.equal(typeof payload.status, 'string')
  assert.equal(typeof payload.service, 'string')
})

test('object lookup returns the record shape expected by starbase', {
  skip: !isIntegrationEnabled() || !hasRequiredObjectLookupEnv(),
}, async () => {
  const { response, payload } = await requestJson(
    `/api/v1/objects/${encodeURIComponent(envValue(objectIdEnvVar))}`,
    envValue(tokenEnvVar),
  )

  assert.equal(
    response.status,
    200,
    `expected 200 from object lookup, got ${response.status}: ${JSON.stringify(payload)}`,
  )
  assert.equal(typeof payload, 'object')
  assert.ok(payload)
  assert.equal(payload.id, envValue(objectIdEnvVar))
  assert.equal(typeof payload.path, 'string')
  assert.equal(typeof payload.zone, 'string')
  assert.equal(typeof payload.checksum, 'string')
  assert.equal(typeof payload.size, 'number')
})

test('collection lookup returns the record shape expected by starbase', {
  skip: !isIntegrationEnabled() || !hasRequiredCollectionLookupEnv(),
}, async () => {
  const { response, payload } = await requestJson(
    `/api/v1/collections/${encodeURIComponent(envValue(collectionIdEnvVar))}`,
    envValue(tokenEnvVar),
  )

  assert.equal(
    response.status,
    200,
    `expected 200 from collection lookup, got ${response.status}: ${JSON.stringify(payload)}`,
  )
  assert.equal(typeof payload, 'object')
  assert.ok(payload)
  assert.equal(payload.id, envValue(collectionIdEnvVar))
  assert.equal(typeof payload.path, 'string')
  assert.equal(typeof payload.zone, 'string')

  if (payload.childCount !== undefined) {
    assert.equal(typeof payload.childCount, 'number')
  }
})
