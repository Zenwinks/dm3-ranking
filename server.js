import express from 'express'

const app = express()
const PORT = 3001

const TARGET_PHASE_ID = '200000002879539' // P2 — phase sélectionnée par l'utilisateur
const FETCH_URL = `https://competitions.ffbb.com/ligues/pdl/comites/0044/competitions/dm3/classement?phase=${TARGET_PHASE_ID}&poule=200000003033338`

/**
 * Finds the `phases` array in the RSC payload and extracts pool/team data.
 */
function extractPhasesFromText(text) {
  const idx = text.indexOf('"phases":[')
  if (idx === -1) return null

  // Bracket-match to extract the full array
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

  // Unescape RSC payloads from __next_f.push([1,"..."]) calls
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

  // Find the target phase by ID
  const targetPhase = phases.find(p => p.id === TARGET_PHASE_ID)
  if (!targetPhase) {
    const available = phases.map(p => `${p.id} (${p.phase_code})`).join(', ')
    throw new Error(`Phase ${TARGET_PHASE_ID} non trouvée. Phases disponibles : ${available}`)
  }

  // Build pool data
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

    // Pool name: keep only the letter (e.g. "Poule A" → "A")
    const poolName = poule.nom?.replace(/^Poule\s*/i, '') || poule.nom || '?'

    return { poolId: poule.id, poolName, teams }
  })

  return pools
}

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  next()
})

app.get('/api/rankings', async (req, res) => {
  console.log(`[${new Date().toISOString()}] Fetching rankings (single request)...`)
  try {
    const pools = await fetchAllRankings()
    const totalTeams = pools.reduce((sum, p) => sum + p.teams.length, 0)
    console.log(`Done. ${totalTeams} teams across ${pools.length} pools.`)
    res.json({ pools, updatedAt: new Date().toISOString() })
  } catch (error) {
    console.error('Error:', error.message)
    res.status(500).json({ error: error.message })
  }
})

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`)
})
