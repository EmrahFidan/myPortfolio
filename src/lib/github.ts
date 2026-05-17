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

const EXCLUDED = new Set([
  'myPortfolio',
  'EmrahFidan',
  'YuLaF-Privacy',
  'myday-notifications',
  'AppleDisease_IP-Project',
  'OKA',
  'RevenueRadar',
  'solo-habits',
])

const FEATURED = new Set([
  'AgriScan',
  'MissingLink',
  'clientflow',
  'xelay-app',
  'YuLaF-YouTube-Language-Filter',
])

interface ContributorMeta {
  owner?: string                  // repo owner (defaults to 'EmrahFidan')
  description: string
  originalUrl: string
  liveUrl?: string
  tags: string[]
  category?: GitHubRepo['category']
  featured?: boolean
  priority?: number               // higher = earlier in the list (default 0)
}

// Projects shown via manual metadata — covers:
//  - private forks (contributions to others' repos)
//  - collaborator repos owned by other users/orgs
//  - own private repos worth showcasing
const CONTRIBUTOR_META: Record<string, ContributorMeta> = {
  'YuLaF-YouTube-Language-Filter': {
    owner: 'vakkaskarakurt',
    description: 'YouTube videolarını konuşulan dile göre filtreleyen 61+ dil destekli Chrome eklentisi — dil öğrenenlerin akışını hedef dilde içerikle sınırlamasını sağlar.',
    originalUrl: 'https://github.com/vakkaskarakurt/YuLaF-YouTube-Language-Filter',
    liveUrl: 'https://chromewebstore.google.com/detail/yulaf-%E2%80%93-youtube-language/ejfoldoabjeidjdddhomeaojicaemdpm',
    tags: ['chrome-extension', 'javascript', 'youtube', 'language-filter'],
    featured: true,
    priority: 100,
  },
  'UrunBu': {
    owner: 'vakkaskarakurt',
    description: 'Migros ve Şok ürünlerini Fullness Factor™ skoru ve fiyat/performans analiziyle 5 kademede derecelendiren React+Python gıda rehberi — alışverişçilerin sağlıklı ve ekonomik seçim yapmasını kolaylaştırır.',
    originalUrl: 'https://github.com/vakkaskarakurt/UrunBu',
    liveUrl: 'https://urunbu.netlify.app',
    tags: ['react', 'python', 'data-pipeline', 'nutrition', 'fullness-factor'],
  },
  'Worth2Watch_FrontEnd': {
    owner: 'kedabaliyildirim',
    description: 'İzlenecek film ve dizileri topluluk puanlarıyla keşfettiren Vue 3 SPA — kullanıcıların kişisel izleme listesi oluşturup yapımları "izlemeye değer mi" perspektifinden değerlendirmesini sağlar.',
    originalUrl: 'https://github.com/kedabaliyildirim/Worth2Watch_FrontEnd',
    liveUrl: 'https://worth2watch.netlify.app',
    tags: ['vue', 'spa', 'movies', 'recommendations'],
    category: 'web',
  },
  'tvshow-complexity': {
    owner: 'TV-SHOW-COMPLEXITY',
    description: 'Dizi ve film altyazılarını CEFR (A1–C2) dil seviyesine, kelime kapsamına ve konuşma hızına (WPM) göre analiz eden Python+React platformu — dil öğrenenlerin seviyelerine uygun izleme listeleri seçmesini sağlar.',
    originalUrl: 'https://github.com/TV-SHOW-COMPLEXITY/tvshow-complexity',
    tags: ['python', 'flask', 'react', 'nlp', 'cefr'],
    category: 'ai-ml',
    featured: true,
    priority: 50,
  },
  'mapfilter': {
    description: 'Google Haritalar\'ın yetersiz filtreleme deneyimini çözen Flutter mobil uygulaması — kullanıcıların idari sınır seçerek bölgesel arama yapmasını ve istenmeyen mekanları engellemesini sağlar.',
    originalUrl: 'https://github.com/EmrahFidan/mapfilter',
    tags: ['flutter', 'dart', 'google-maps', 'firebase'],
    category: 'mobile',
    featured: true,
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
      const meta = CONTRIBUTOR_META[repo.name]
      // Show meta-defined projects only when the API row matches the canonical owner —
      // prevents duplicates when both an upstream collab repo and a local fork exist
      if (meta) return repo.owner?.login === (meta.owner ?? 'EmrahFidan')
      // Otherwise: only own public, non-fork repos
      return !repo.fork && !repo.private && repo.owner?.login === 'EmrahFidan'
    })
    .map((repo: any) => {
      const topics: string[] = repo.topics ?? []
      const meta = CONTRIBUTOR_META[repo.name]
      const isOwnProject = repo.owner?.login === 'EmrahFidan' && !repo.fork

      const tags = meta?.tags ?? (
        topics.length > 0 ? topics.slice(0, 5) : [repo.language].filter(Boolean)
      )

      return {
        name: repo.name,
        description: meta?.description ?? repo.description ?? '',
        url: meta?.originalUrl ?? repo.html_url,
        liveUrl: meta?.liveUrl ?? repo.homepage ?? undefined,
        tags,
        category: meta?.category ?? inferCategory(topics, repo.language ?? '', repo.name),
        featured: meta?.featured ?? FEATURED.has(repo.name),
        contributor: !isOwnProject,
        language: repo.language ?? '',
        stars: repo.stargazers_count ?? 0,
      } satisfies GitHubRepo
    })
    .sort((a: GitHubRepo, b: GitHubRepo) => {
      // Manual priority (meta.priority) wins everything
      const pa = CONTRIBUTOR_META[a.name]?.priority ?? 0
      const pb = CONTRIBUTOR_META[b.name]?.priority ?? 0
      if (pa !== pb) return pb - pa
      // Then: live+contributor > live+featured > contributor > featured > rest
      const score = (r: GitHubRepo) => {
        if (r.contributor && r.liveUrl) return 5
        if (r.featured && r.liveUrl) return 4
        if (r.contributor) return 3
        if (r.featured) return 2
        if (r.liveUrl) return 1
        return 0
      }
      return score(b) - score(a) || a.name.localeCompare(b.name)
    })

  // Fetch READMEs for featured + contributor projects
  await Promise.all(
    repos
      .filter(r => r.featured || r.contributor)
      .map(async r => {
        const owner = CONTRIBUTOR_META[r.name]?.owner ?? 'EmrahFidan'
        const { excerpt, stats } = await fetchReadme(owner, r.name, headers)
        if (excerpt) r.readme = excerpt
        if (stats.length) r.stats = stats
      })
  )

  return repos
}
