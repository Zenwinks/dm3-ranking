const TARGET_PHASE_ID = '200000002879539'
const BASE_URL = 'https://competitions.ffbb.com/ligues/pdl/comites/0044/competitions/dm3'
const CLASSEMENT_URL = `${BASE_URL}/classement?phase=${TARGET_PHASE_ID}&poule=200000003033338`
const MATCHES_URL = `${BASE_URL}?phase=${TARGET_PHASE_ID}&poule=200000003033338`

function extractRscText(html) {
  const segments = []
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/gs
  let m
  while ((m = re.exec(html)) !== null) {
    try { segments.push(JSON.parse(`"${m[1]}"`)) }
    catch (_) { segments.push(m[1]) }
  }
  return segments.join('\n')
}

function extractPhasesFromText(text) {
  const needle = '"phases":['
  let searchIdx = 0
  while (true) {
    const idx = text.indexOf(needle, searchIdx)
    if (idx === -1) return null

    let depth = 0
    let end = idx + '"phases":'.length
    while (end < text.length) {
      const c = text[end]
      if (c === '[' || c === '{') depth++
      else if (c === ']' || c === '}') { depth--; if (depth === 0) break }
      end++
    }

    try {
      const arr = JSON.parse(text.slice(idx + '"phases":'.length, end + 1))
      if (arr.length > 0 && arr[0].id) return arr
    } catch (_) { /* try next */ }
    searchIdx = end + 1
  }
}

function extractAllRencontres(text) {
  const searchStr = '"rencontres":['
  const results = []
  let searchIdx = 0
  while (true) {
    const idx = text.indexOf(searchStr, searchIdx)
    if (idx === -1) break
    let depth = 0
    let end = idx + searchStr.length - 1
    while (end < text.length) {
      const c = text[end]
      if (c === '[' || c === '{') depth++
      else if (c === ']' || c === '}') { depth--; if (depth === 0) break }
      end++
    }
    try {
      const arr = JSON.parse(text.slice(idx + '"rencontres":'.length, end + 1))
      results.push(...arr)
    } catch (_) { /* skip malformed */ }
    searchIdx = end + 1
  }
  return results
}

function mapRencontre(r) {
  return {
    id: r.id,
    journee: Number(r.numeroJournee) || 0,
    date: r.date_rencontre || null,
    equipe1: { nom: r.idEngagementEquipe1?.nom || '?' },
    equipe2: { nom: r.idEngagementEquipe2?.nom || '?' },
    score1: r.joue ? Number(r.resultatEquipe1) || 0 : null,
    score2: r.joue ? Number(r.resultatEquipe2) || 0 : null,
    played: !!r.joue,
    salle: r.salle?.libelle || null,
    ville: r.salle?.cartographie?.ville || null,
  }
}

const FETCH_HEADERS = {
  'Accept': 'text/html,application/xhtml+xml',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

async function fetchRscText(url) {
  const response = await fetch(url, { headers: FETCH_HEADERS })
  if (!response.ok) throw new Error(`HTTP ${response.status} lors du fetch FFBB`)
  return extractRscText(await response.text())
}

async function fetchAllData() {
  const [classementText, matchesText] = await Promise.all([
    fetchRscText(CLASSEMENT_URL),
    fetchRscText(MATCHES_URL),
  ])

  const phases = extractPhasesFromText(classementText)
  if (!phases) throw new Error('Impossible de trouver les données de phases dans la page FFBB')

  const targetPhase = phases.find(p => p.id === TARGET_PHASE_ID)
  if (!targetPhase) {
    const available = phases.map(p => `${p.id} (${p.phase_code})`).join(', ')
    throw new Error(`Phase ${TARGET_PHASE_ID} non trouvée. Phases disponibles : ${available}`)
  }

  const poolIds = new Set((targetPhase.poules || []).map(p => p.id))

  const pools = (targetPhase.poules || []).map(poule => {
    const teams = (poule.classements || [])
      .filter(c => c.idEngagement?.nom)
      .map(c => ({
        nom: String(c.idEngagement.nom),
        position: Number(c.position) || 0,
        points: Number(c.points) || 0,
        matchJoues: Number(c.matchJoues) || 0,
        gagnes: Number(c.gagnes) || 0,
        perdus: Number(c.perdus) || 0,
        nuls: Number(c.nuls) || 0,
        paniersMarques: Number(c.paniersMarques) || 0,
        paniersEncaisses: Number(c.paniersEncaisses) || 0,
        penalites: Number(c.penalites) || 0,
      }))
      .sort((a, b) => a.position - b.position)

    const poolName = poule.nom?.replace(/^Poule\s*/i, '') || poule.nom || '?'
    return { poolId: poule.id, poolName, teams }
  })

  const allRencontres = extractAllRencontres(matchesText)
  const phaseRencontres = allRencontres.filter(r => poolIds.has(r.idPoule?.id))

  const matchesByPool = {}
  for (const r of phaseRencontres) {
    const pouleId = r.idPoule.id
    if (!matchesByPool[pouleId]) matchesByPool[pouleId] = {}
    const jour = Number(r.numeroJournee) || 0
    if (!matchesByPool[pouleId][jour]) matchesByPool[pouleId][jour] = []
    matchesByPool[pouleId][jour].push(mapRencontre(r))
  }

  for (const pool of pools) {
    const byJour = matchesByPool[pool.poolId] || {}
    pool.journees = Object.keys(byJour)
      .map(Number)
      .sort((a, b) => a - b)
      .map(num => ({ numero: num, matches: byJour[num] }))
  }

  return pools
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  try {
    const pools = await fetchAllData()
    res.json({ pools, updatedAt: new Date().toISOString() })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
