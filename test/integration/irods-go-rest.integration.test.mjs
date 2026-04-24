import assert from 'node:assert/strict'
import test from 'node:test'

const integrationEnabledEnvVar = 'STARBASE_INTEGRATION'
const baseUrlEnvVar = 'STARBASE_TEST_BASE_URL'
const tokenEnvVar = 'STARBASE_TEST_BEARER_TOKEN'
const basicUserEnvVar = 'STARBASE_TEST_BASIC_USERNAME'
const basicPasswordEnvVar = 'STARBASE_TEST_BASIC_PASSWORD'
const pathEnvVar = 'STARBASE_TEST_IRODS_PATH'
const collectionPathEnvVar = 'STARBASE_TEST_COLLECTION_PATH'

function envValue(name) {
  return process.env[name]?.trim() ?? ''
}

function isIntegrationEnabled() {
  return /^(1|true|yes)$/i.test(envValue(integrationEnabledEnvVar))
}

function integrationBaseUrl() {
  return (envValue(baseUrlEnvVar) || 'http://localhost:8080').replace(/\/$/, '')
}

function authorizationHeader() {
  if (envValue(tokenEnvVar)) {
    return `Bearer ${envValue(tokenEnvVar)}`
  }

  if (envValue(basicUserEnvVar) && envValue(basicPasswordEnvVar)) {
    const credentials = Buffer.from(
      `${envValue(basicUserEnvVar)}:${envValue(basicPasswordEnvVar)}`,
    ).toString('base64')
    return `Basic ${credentials}`
  }

  return ''
}

function hasProtectedAuthEnv() {
  return Boolean(authorizationHeader())
}

async function requestJson(path) {
  const auth = authorizationHeader()
  const response = await fetch(`${integrationBaseUrl()}${path}`, {
    headers: auth
      ? {
          Accept: 'application/json',
          Authorization: auth,
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

test('path lookup returns the record shape expected by starbase', {
  skip: !isIntegrationEnabled() || !hasProtectedAuthEnv() || !envValue(pathEnvVar),
}, async () => {
  const { response, payload } = await requestJson(
    `/api/v1/path?irods_path=${encodeURIComponent(envValue(pathEnvVar))}`,
  )

  assert.equal(
    response.status,
    200,
    `expected 200 from path lookup, got ${response.status}: ${JSON.stringify(payload)}`,
  )
  assert.equal(typeof payload, 'object')
  assert.ok(payload)
  assert.equal(payload.path, envValue(pathEnvVar))
  assert.equal(typeof payload.id, 'string')
  assert.equal(typeof payload.kind, 'string')
  assert.equal(typeof payload.zone, 'string')
})

test('collection child listing returns the shape expected by starbase', {
  skip:
    !isIntegrationEnabled() ||
    !hasProtectedAuthEnv() ||
    !envValue(collectionPathEnvVar),
}, async () => {
  const { response, payload } = await requestJson(
    `/api/v1/path/children?irods_path=${encodeURIComponent(envValue(collectionPathEnvVar))}`,
  )

  assert.equal(
    response.status,
    200,
    `expected 200 from child listing, got ${response.status}: ${JSON.stringify(payload)}`,
  )
  assert.equal(typeof payload, 'object')
  assert.ok(payload)
  assert.equal(payload.irods_path, envValue(collectionPathEnvVar))
  assert.ok(Array.isArray(payload.children))

  for (const child of payload.children) {
    assert.equal(typeof child.id, 'string')
    assert.equal(typeof child.path, 'string')
    assert.equal(typeof child.kind, 'string')
    assert.equal(typeof child.zone, 'string')
  }
})
