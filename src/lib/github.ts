export interface GitHubRepo {
  name: string
  description: string
  url: string
  liveUrl?: string
  tags: string[]
  category: 'ai-ml' | 'web' | 'mobile' | 'other'
  featured: boolean
  contributor: boolean   // true = contributed to someone else's project (fork)
  language: string
  stars: number
  readme?: string
  stats?: string[]
}

const EXCLUDED = new Set(['myPortfolio', 'EmrahFidan'])

const FEATURED = new Set([
  'AgriScan',
  'MissingLink',
  'RevenueRadar',
  'clientflow',
  'xelay-app',
])

// Private forks that are contribution projects — manually filled since private
const CONTRIBUTOR_META: Record<string, { description: string; liveUrl?: string; tags: string[] }> = {
  'OKA': {
    description: 'Voice-controlled RC car — multi-modal speech recognition (Whisper + Google Cloud), ArUco marker-based autonomous navigation, real-time computer vision.',
    tags: ['python', 'computer-vision', 'speech-recognition', 'aruco', 'raspberry-pi'],
  },
  'YuLaF-YouTube-Language-Filter': {
    description: 'Chrome extension to filter YouTube videos by spoken language. Supports 20+ languages with a clean popup UI.',
    liveUrl: undefined,
    tags: ['chrome-extension', 'javascript', 'youtube', 'language-filter'],
  },
  'UrunBu': {
    description: 'Smart food guide for Migros products — Fullness Factor™ scoring, price/performance analysis, 5-tier quality rating. React + Python data pipeline.',
    liveUrl: 'https://urunbu.netlify.app',
    tags: ['react', 'python', 'data-pipeline', 'nutrition', 'fullness-factor'],
  },
}

function inferCategory(topics: string[], language: string, repoName: string): GitHubRepo['category'] {
  const t = topics.join(' ').toLowerCase() + ' ' + repoName.toLowerCase()
  const l = (language || '').toLowerCase()

  if (
    t.includes('machine-learning') || t.includes('deep-learning') || t.includes('yolo') ||
    t.includes('ctgan') || t.includes('computer-vision') || t.includes('ai') ||
    t.includes('speech-recognition') || t.includes('aruco') ||
    t.includes('synthetic-data') || t.includes('lead-scoring') || l === 'jupyter notebook'
  ) return 'ai-ml'

  if (
    t.includes('react-native') || t.includes('expo') || t.includes('mobile') ||
    t.includes('flutter') || l === 'dart'
  ) return 'mobile'

  if (
    t.includes('react') || t.includes('nextjs') || t.includes('astro') ||
    t.includes('web') || t.includes('firebase') || t.includes('saas') ||
    t.includes('chrome-extension') || t.includes('extension') ||
    l === 'typescript' || l === 'javascript' || l === 'css'
  ) return 'web'

  return 'other'
}

function parseReadme(raw: string): { excerpt: string; stats: string[] } {
  const cleaned = raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/!\[.*?\]\(https?:\/\/[^\)]*shields\.io[^\)]*\)/gi, '')
    .replace(/!\[.*?\]\(https?:\/\/[^\)]*badge[^\)]*\)/gi, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, m => m.slice(1, -1))

  const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean)

  let excerpt = ''
  for (const line of lines) {
    if (line.startsWith('#') || line.startsWith('!') || line.startsWith('[')) continue
    if (line.startsWith('|') || line.startsWith('>')) continue
    if (line.startsWith('-') && line.length < 30) continue
    if (line.length < 40) continue
    excerpt = line.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    break
  }

  const statMatches: string[] = []
  const statRe = /(\d[\d,.]*\s*[%+k]?\s*[a-zA-Z][a-zA-Z\s\/]{2,25})/g
  let m: RegExpExecArray | null
  while ((m = statRe.exec(cleaned)) !== null && statMatches.length < 3) {
    const s = m[1].trim()
    if (s.length > 4 && s.length < 50) statMatches.push(s)
  }

  return { excerpt: excerpt.slice(0, 220), stats: statMatches.slice(0, 3) }
}

async function fetchReadme(owner: string, repo: string, headers: Record<string, string>): Promise<{ excerpt: string; stats: string[] }> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/readme`,
      { headers }
    )
    if (!res.ok) return { excerpt: '', stats: [] }
    const data = await res.json()
    const raw = Buffer.from(data.content, 'base64').toString('utf-8')
    return parseReadme(raw)
  } catch {
    return { excerpt: '', stats: [] }
  }
}

export async function fetchPublicRepos(): Promise<GitHubRepo[]> {
  const token = import.meta.env.GITHUB_TOKEN || process.env.GITHUB_TOKEN || ''
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'myPortfolio-site',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  // Fetch own repos (public + private forks if authenticated)
  const endpoint = token
    ? 'https://api.github.com/user/repos?visibility=all&sort=updated&per_page=100'
    : 'https://api.github.com/users/EmrahFidan/repos?type=public&sort=updated&per_page=100'

  const res = await fetch(endpoint, { headers })
  if (!res.ok) {
    console.error(`GitHub API error: ${res.status}`)
    return []
  }

  const data = await res.json()

  const repos: GitHubRepo[] = data
    .filter((repo: any) => {
      if (EXCLUDED.has(repo.name)) return false
      // Include: own public repos + private forks (contributor projects)
      if (!repo.fork && !repo.private) return true
      if (repo.fork && repo.private && CONTRIBUTOR_META[repo.name]) return true
      return false
    })
    .map((repo: any) => {
      const topics: string[] = repo.topics ?? []
      const isFork = !!repo.fork
      const meta = CONTRIBUTOR_META[repo.name]

      const tags = meta?.tags ?? (
        topics.length > 0 ? topics.slice(0, 5) : [repo.language].filter(Boolean)
      )

      return {
        name: repo.name,
        description: meta?.description ?? repo.description ?? '',
        url: repo.html_url,
        liveUrl: meta?.liveUrl ?? repo.homepage ?? undefined,
        tags,
        category: inferCategory(topics, repo.language ?? '', repo.name),
        featured: FEATURED.has(repo.name),
        contributor: isFork,
        language: repo.language ?? '',
        stars: repo.stargazers_count ?? 0,
      } satisfies GitHubRepo
    })
    .sort((a: GitHubRepo, b: GitHubRepo) => {
      if (a.featured && !b.featured) return -1
      if (!a.featured && b.featured) return 1
      if (a.contributor && !b.contributor) return 1
      if (!a.contributor && b.contributor) return -1
      return a.name.localeCompare(b.name)
    })

  // Fetch READMEs for featured + contributor projects
  await Promise.all(
    repos
      .filter(r => r.featured || r.contributor)
      .map(async r => {
        const owner = r.contributor ? 'EmrahFidan' : 'EmrahFidan'
        const { excerpt, stats } = await fetchReadme(owner, r.name, headers)
        if (excerpt) r.readme = excerpt
        if (stats.length) r.stats = stats
      })
  )

  return repos
}
