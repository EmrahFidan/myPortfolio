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
}

// Projects to exclude from the portfolio
const EXCLUDED = new Set([
  'myPortfolio',
  'EmrahFidan', // profile README repo
])

// Override featured status
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

  if (t.includes('machine-learning') || t.includes('deep-learning') || t.includes('yolo') ||
      t.includes('ctgan') || t.includes('computer-vision') || t.includes('ai') ||
      t.includes('synthetic-data') || t.includes('lead-scoring') || l === 'jupyter notebook') {
    return 'ai-ml'
  }

  if (t.includes('react-native') || t.includes('expo') || t.includes('mobile') ||
      t.includes('flutter') || l === 'dart') {
    return 'mobile'
  }

  if (t.includes('react') || t.includes('nextjs') || t.includes('astro') ||
      t.includes('web') || t.includes('firebase-hosting') || t.includes('saas') ||
      l === 'typescript' || l === 'javascript' || l === 'css') {
    return 'web'
  }

  return 'other'
}

export async function fetchPublicRepos(): Promise<GitHubRepo[]> {
  const res = await fetch(
    'https://api.github.com/users/EmrahFidan/repos?type=public&sort=updated&per_page=100',
    {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'myPortfolio-site',
      },
    }
  )

  if (!res.ok) {
    console.error(`GitHub API error: ${res.status}`)
    return []
  }

  const data = await res.json()

  return data
    .filter((repo: any) => !EXCLUDED.has(repo.name) && !repo.fork)
    .map((repo: any) => {
      const topics: string[] = repo.topics ?? []
      const tags = topics.length > 0
        ? topics.slice(0, 5)
        : [repo.language].filter(Boolean)

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
      // Featured first, then alphabetical
      if (a.featured && !b.featured) return -1
      if (!a.featured && b.featured) return 1
      return a.name.localeCompare(b.name)
    })
}
