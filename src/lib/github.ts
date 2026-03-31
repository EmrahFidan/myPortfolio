export interface GitHubRepo {
  name: string
  description: string
  url: string
  liveUrl?: string
  tags: string[]
  category: 'ai-ml' | 'web' | 'mobile' | 'other'
  featured: boolean
  language: string
  stars: number
  readme?: string        // short excerpt from README
  stats?: string[]       // key metrics found in README (e.g. "91.35% F1 score")
}

const EXCLUDED = new Set(['myPortfolio', 'EmrahFidan'])

const FEATURED = new Set([
  'AgriScan',
  'MissingLink',
  'RevenueRadar',
  'clientflow',
  'xelay-app',
])

function inferCategory(topics: string[], language: string): GitHubRepo['category'] {
  const t = topics.join(' ').toLowerCase()
  const l = (language || '').toLowerCase()

  if (
    t.includes('machine-learning') || t.includes('deep-learning') || t.includes('yolo') ||
    t.includes('ctgan') || t.includes('computer-vision') || t.includes('ai') ||
    t.includes('synthetic-data') || t.includes('lead-scoring') || l === 'jupyter notebook'
  ) return 'ai-ml'

  if (
    t.includes('react-native') || t.includes('expo') || t.includes('mobile') ||
    t.includes('flutter') || l === 'dart'
  ) return 'mobile'

  if (
    t.includes('react') || t.includes('nextjs') || t.includes('astro') ||
    t.includes('web') || t.includes('firebase-hosting') || t.includes('saas') ||
    l === 'typescript' || l === 'javascript' || l === 'css'
  ) return 'web'

  return 'other'
}

/** Extract a clean excerpt + key stats from raw README markdown */
function parseReadme(raw: string): { excerpt: string; stats: string[] } {
  // Remove HTML comments, badges (shield.io img lines), and code blocks
  const cleaned = raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/!\[.*?\]\(https?:\/\/[^\)]*shields\.io[^\)]*\)/gi, '')
    .replace(/!\[.*?\]\(https?:\/\/[^\)]*badge[^\)]*\)/gi, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, (m) => m.slice(1, -1)) // inline code → plain text

  const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean)

  // Find first real paragraph (not a heading, not a lone link/image, min 40 chars)
  let excerpt = ''
  for (const line of lines) {
    if (line.startsWith('#')) continue
    if (line.startsWith('!') || line.startsWith('[')) continue
    if (line.startsWith('|') || line.startsWith('>')) continue
    if (line.startsWith('-') && line.length < 30) continue
    if (line.length < 40) continue
    excerpt = line.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // strip links
    break
  }

  // Extract numeric stats: patterns like "91.35% F1", "92.78% accuracy", "1000+ attendees", "46 volunteers"
  const statMatches: string[] = []
  const statRe = /(\d[\d,.]*\s*[%+k]?\s*[a-zA-Z][a-zA-Z\s\/]{2,25})/g
  let m: RegExpExecArray | null
  while ((m = statRe.exec(cleaned)) !== null && statMatches.length < 3) {
    const s = m[1].trim()
    if (s.length > 4 && s.length < 50) statMatches.push(s)
  }

  return {
    excerpt: excerpt.slice(0, 220),
    stats: statMatches.slice(0, 3),
  }
}

async function fetchReadme(owner: string, repo: string): Promise<{ excerpt: string; stats: string[] }> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/readme`,
      { headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'myPortfolio-site' } }
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
  const res = await fetch(
    'https://api.github.com/users/EmrahFidan/repos?type=public&sort=updated&per_page=100',
    { headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'myPortfolio-site' } }
  )

  if (!res.ok) {
    console.error(`GitHub API error: ${res.status}`)
    return []
  }

  const data = await res.json()

  const repos: GitHubRepo[] = data
    .filter((repo: any) => !EXCLUDED.has(repo.name) && !repo.fork)
    .map((repo: any) => {
      const topics: string[] = repo.topics ?? []
      const tags = topics.length > 0 ? topics.slice(0, 5) : [repo.language].filter(Boolean)

      return {
        name: repo.name,
        description: repo.description ?? '',
        url: repo.html_url,
        liveUrl: repo.homepage || undefined,
        tags,
        category: inferCategory(topics, repo.language ?? ''),
        featured: FEATURED.has(repo.name),
        language: repo.language ?? '',
        stars: repo.stargazers_count ?? 0,
      } satisfies GitHubRepo
    })
    .sort((a: GitHubRepo, b: GitHubRepo) => {
      if (a.featured && !b.featured) return -1
      if (!a.featured && b.featured) return 1
      return a.name.localeCompare(b.name)
    })

  // Fetch README only for featured projects (to keep build fast)
  await Promise.all(
    repos
      .filter(r => r.featured)
      .map(async r => {
        const { excerpt, stats } = await fetchReadme('EmrahFidan', r.name)
        if (excerpt) r.readme = excerpt
        if (stats.length) r.stats = stats
      })
  )

  return repos
}
