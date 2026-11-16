// Minimal GitHub Gist client: read one file, write one file, check who a key belongs to.

const API = 'https://api.github.com'

export type GistErrorKind = 'auth' | 'forbidden' | 'not-found' | 'rate-limit' | 'network' | 'bad-response'

export class GistError extends Error {
  override name = 'GistError'
  readonly kind: GistErrorKind
  constructor(message: string, kind: GistErrorKind) {
    super(message)
    this.kind = kind
  }
}

export interface GistFile {
  text: string
  ownerLogin: string | null
}

interface GistJson {
  owner?: { login?: string }
  files?: Record<string, { content?: string; truncated?: boolean; raw_url?: string } | null>
}

function headers(token: string | null): Record<string, string> {
  const h: Record<string, string> = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

async function request(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { cache: 'no-store', ...init })
  } catch {
    throw new GistError('Could not reach GitHub. Check your internet connection.', 'network')
  }
}

function failure(res: Response, action: string): GistError {
  if (res.status === 401) return new GistError('GitHub rejected the key (wrong or expired). Enter it again.', 'auth')
  if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
    return new GistError('GitHub’s rate limit was reached. Wait a few minutes, or add a key.', 'rate-limit')
  }
  if (res.status === 403) return new GistError(`This key isn’t allowed to ${action}.`, 'forbidden')
  if (res.status === 404) return new GistError('Gist not found. Check the Gist ID, and that the key can see it.', 'not-found')
  return new GistError(`GitHub returned an error (${res.status}) while trying to ${action}.`, 'bad-response')
}

async function json<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T
  } catch {
    throw new GistError('GitHub sent a response that could not be read.', 'bad-response')
  }
}

export async function readGist(gistId: string, filename: string, token: string | null): Promise<GistFile> {
  const res = await request(`${API}/gists/${encodeURIComponent(gistId)}`, { headers: headers(token) })
  if (!res.ok) throw failure(res, 'read the timeline')
  const body = await json<GistJson>(res)
  const file = body.files?.[filename]
  if (!file) throw new GistError(`The Gist has no file called ${filename}.`, 'not-found')
  let text = file.content ?? ''
  // Files over ~1 MB are truncated in the API response; fetch the full text.
  if (file.truncated && file.raw_url) {
    const raw = await request(file.raw_url, {})
    if (!raw.ok) throw failure(raw, 'read the timeline')
    text = await raw.text()
  }
  return { text, ownerLogin: body.owner?.login ?? null }
}

/** Replaces the file's content. Checks GitHub's reply to confirm what was stored. */
export async function writeGist(gistId: string, filename: string, token: string, text: string): Promise<void> {
  const res = await request(`${API}/gists/${encodeURIComponent(gistId)}`, {
    method: 'PATCH',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: { [filename]: { content: text } } }),
  })
  if (!res.ok) throw failure(res, 'save to the Gist')
  const saved = (await json<GistJson>(res)).files?.[filename]
  if (saved && !saved.truncated && saved.content !== undefined && saved.content !== text) {
    throw new GistError('GitHub accepted the save but returned different content. Refresh to check what was stored.', 'bad-response')
  }
}

/** The GitHub username a key belongs to. */
export async function keyOwner(token: string): Promise<string> {
  const res = await request(`${API}/user`, { headers: headers(token) })
  if (!res.ok) throw failure(res, 'identify itself')
  const login = (await json<{ login?: string }>(res)).login
  if (!login) throw new GistError('GitHub did not say who this key belongs to.', 'bad-response')
  return login
}
