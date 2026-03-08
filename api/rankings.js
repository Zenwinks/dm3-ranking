const TARGET_PHASE_ID = '200000002879539'
const FETCH_URL = `https://competitions.ffbb.com/ligues/pdl/comites/0044/competitions/dm3/classement?phase=${TARGET_PHASE_ID}&poule=200000003033338`

function extractPhasesFromText(text) {
  const idx = text.indexOf('"phases":[')
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
    return JSON.parse(text.slice(idx + '"phases":'.length, end + 1))
  } catch (_) {
    return null
  }
}

async function fetchAllRankings() {
  const response = await fetch(FETCH_URL, {
    headers: {
      'Accept': 'text/html,application/xhtml+xml',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} lors du fetch FFBB`)

  const html = await response.text()

  const segments = []
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/gs
  let m
  while ((m = re.exec(html)) !== null) {
    try { segments.push(JSON.parse(`"${m[1]}"`)) }
    catch (_) { segments.push(m[1]) }
  }

  const combined = segments.join('\n')
  const phases = extractPhasesFromText(combined)
  if (!phases) throw new Error('Impossible de trouver les données de phases dans la page FFBB')

  const targetPhase = phases.find(p => p.id === TARGET_PHASE_ID)
  if (!targetPhase) {
    const available = phases.map(p => `${p.id} (${p.phase_code})`).join(', ')
    throw new Error(`Phase ${TARGET_PHASE_ID} non trouvée. Phases disponibles : ${available}`)
  }

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

  return pools
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  try {
    const pools = await fetchAllRankings()
    res.json({ pools, updatedAt: new Date().toISOString() })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
