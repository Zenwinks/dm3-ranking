<script setup>
import { ref, computed, onMounted } from 'vue'
import RankingTable from './components/RankingTable.vue'
import MatchdayView from './components/MatchdayView.vue'

const loading = ref(false)
const error = ref(null)
const pools = ref([])
const updatedAt = ref(null)
const activeTab = ref('general')

async function fetchRankings() {
  loading.value = true
  error.value = null
  try {
    const res = await fetch('/api/rankings')
    if (!res.ok) throw new Error(`Erreur serveur : ${res.status}`)
    const data = await res.json()
    pools.value = data.pools
    updatedAt.value = data.updatedAt
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

// Critères de départage (appliqués au sein de chaque groupe de position) :
//   1. % de victoires (V / Jm)
//   2. Quotient (PM / PE)
//   3. Moyenne de points marqués (PM / Jm)
function sortFn(a, b) {
  // 1. % de victoires
  const winPctA = a.matchJoues > 0 ? a.gagnes / a.matchJoues : 0
  const winPctB = b.matchJoues > 0 ? b.gagnes / b.matchJoues : 0
  if (Math.abs(winPctB - winPctA) > 1e-9) return winPctB - winPctA

  // 2. Quotient paniers marqués / paniers encaissés
  const quotA = a.paniersEncaisses > 0 ? a.paniersMarques / a.paniersEncaisses : 0
  const quotB = b.paniersEncaisses > 0 ? b.paniersMarques / b.paniersEncaisses : 0
  if (Math.abs(quotB - quotA) > 1e-9) return quotB - quotA

  // 3. Moyenne de points marqués par match
  const avgA = a.matchJoues > 0 ? a.paniersMarques / a.matchJoues : 0
  const avgB = b.matchJoues > 0 ? b.paniersMarques / b.matchJoues : 0
  return avgB - avgA
}

// Classement général groupé par zone selon les règles de montée/descente :
//   Maintien  : 1ers (8) + 2èmes (8) + 2 meilleurs 3èmes = 18
//   DM4       : 6 autres 3èmes + 4èmes (8) + 6 meilleurs 5èmes = 22
//   DM5       : 2 autres 5èmes + 6èmes (8) = 10
const generalRanking = computed(() => {
  const all = pools.value.flatMap(pool =>
    pool.teams.map(t => ({ ...t, poolName: pool.poolName }))
  )

  // Regrouper par position dans la poule
  const byPos = {}
  all.forEach(t => {
    ;(byPos[t.position] ??= []).push(t)
  })

  const thirds = [...(byPos[3] ?? [])].sort(sortFn)
  const fifths = [...(byPos[5] ?? [])].sort(sortFn)

  const safe = [
    ...(byPos[1] ?? []).sort(sortFn),
    ...(byPos[2] ?? []).sort(sortFn),
    ...thirds.slice(0, 2).map(t => ({ ...t, tag: 'top3' })),
  ]
  const dm4 = [
    ...thirds.slice(2),
    ...(byPos[4] ?? []).sort(sortFn),
    ...fifths.slice(0, 6).map(t => ({ ...t, tag: 'top5' })),
  ]
  const dm5 = [
    ...fifths.slice(6),                 // 2 autres 5èmes
    ...(byPos[6] ?? []).sort(sortFn),   // tous les 6èmes
  ]

  return [...safe, ...dm4, ...dm5]
})

// Séparateurs dynamiques selon les tailles réelles de chaque zone
const generalZones = computed(() => {
  const all = pools.value.flatMap(p => p.teams)
  const byPos = {}
  all.forEach(t => { (byPos[t.position] ??= []).push(t) })

  const safeCount = (byPos[1]?.length ?? 0)
    + (byPos[2]?.length ?? 0)
    + Math.min(byPos[3]?.length ?? 0, 2)
  const dm4Count = Math.max(0, (byPos[3]?.length ?? 0) - 2)
    + (byPos[4]?.length ?? 0)
    + Math.min(byPos[5]?.length ?? 0, 6)

  return [
    { count: safeCount, label: 'Descente en DM4' },
    { count: dm4Count,  label: 'Descente en DM5' },
  ]
})

const activePool = computed(() =>
  pools.value.find(p => p.poolName === activeTab.value)
)

const formattedDate = computed(() => {
  if (!updatedAt.value) return ''
  return new Date(updatedAt.value).toLocaleString('fr-FR')
})

onMounted(fetchRankings)
</script>

<template>
  <div class="app">
    <header>
      <div class="header-content">
        <h1>DM3 – Classement inter-poules</h1>
        <p class="subtitle">Loire-Atlantique · Pays de la Loire</p>
      </div>
      <button class="refresh-btn" :disabled="loading" @click="fetchRankings">
        <span :class="{ spin: loading }">↻</span>
        {{ loading ? 'Chargement...' : 'Actualiser' }}
      </button>
    </header>

    <div v-if="error" class="error-box">
      <strong>Erreur :</strong> {{ error }}
      <br>Assurez-vous que le serveur API est lancé (<code>npm run server</code>).
    </div>

    <div v-if="loading && pools.length === 0" class="loading-box">
      Chargement des classements...
    </div>

    <template v-if="pools.length > 0">
      <nav class="tabs">
        <button
          :class="['tab', { active: activeTab === 'general' }]"
          @click="activeTab = 'general'"
        >
          Classement général
        </button>
        <button
          v-for="pool in pools"
          :key="pool.poolName"
          :class="['tab', { active: activeTab === pool.poolName }]"
          @click="activeTab = pool.poolName"
        >
          Poule {{ pool.poolName }}
        </button>
      </nav>

      <div class="tab-content">
        <template v-if="activeTab === 'general'">
          <div class="section-header">
            <h2>Classement général ({{ generalRanking.length }} équipes)</h2>
            <p class="note">Départage : classement poule &gt; % victoires &gt; quotient (PM/PE) &gt; moy. points marqués</p>
          </div>
          <div class="legend">
            <span class="legend-item legend-safe">Maintien — 1ers, 2èmes, 2 meilleurs 3èmes</span>
            <span class="legend-item legend-relegate-1">Descente DM4 — autres 3èmes, 4èmes, 6 meilleurs 5èmes</span>
            <span class="legend-item legend-relegate-2">Descente DM5 — autres 5èmes, 6èmes</span>
          </div>
          <RankingTable :teams="generalRanking" :show-pool="true" :zones="generalZones" highlight-team="AS SAINT ROGATIEN NANTES" />
        </template>

        <template v-else-if="activePool">
          <div class="section-header">
            <h2>Poule {{ activePool.poolName }} ({{ activePool.teams.length }} équipes)</h2>
          </div>
          <RankingTable :teams="activePool.teams" :show-pool="false" highlight-team="AS SAINT ROGATIEN NANTES" />

          <MatchdayView
            :journees="activePool.journees || []"
            highlight-team="AS SAINT ROGATIEN NANTES"
            class="pool-matches"
          />
        </template>
      </div>

      <footer v-if="updatedAt">
        Dernière mise à jour : {{ formattedDate }}
      </footer>
    </template>
  </div>
</template>

<style>
html, body {
  background: #f0f4f8;
  font-family: 'Segoe UI', Arial, sans-serif;
  color: #1a1a2e;
  min-height: 100vh;
}
</style>

<style scoped>
.app {
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #1a3a5c;
  color: #fff;
  padding: 20px 24px;
  border-radius: 10px;
  margin-bottom: 20px;
  gap: 16px;
}

h1 {
  font-size: 1.4rem;
  font-weight: 700;
}

.subtitle {
  font-size: 0.85rem;
  opacity: 0.75;
  margin-top: 4px;
}

.refresh-btn {
  background: rgba(255,255,255,0.15);
  color: #fff;
  border: 1px solid rgba(255,255,255,0.3);
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.2s;
}
.refresh-btn:hover:not(:disabled) { background: rgba(255,255,255,0.25); }
.refresh-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.spin { display: inline-block; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.error-box {
  background: #fdecea;
  border: 1px solid #f5c6c2;
  color: #c0392b;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  line-height: 1.6;
}
.error-box code { background: #f9d5d3; padding: 2px 6px; border-radius: 4px; }

.loading-box {
  text-align: center;
  padding: 60px;
  color: #666;
  font-size: 1.1rem;
}

.tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.tab {
  padding: 8px 16px;
  border: 2px solid #d0d8e4;
  background: #fff;
  color: #444;
  border-radius: 6px 6px 0 0;
  cursor: pointer;
  font-size: 0.88rem;
  font-weight: 500;
  transition: all 0.15s;
  border-bottom: none;
}
.tab:hover { background: #eef2f7; }
.tab.active {
  background: #fff;
  border-color: #1a3a5c;
  color: #1a3a5c;
  font-weight: 700;
}

.tab-content {
  background: #fff;
  border: 2px solid #1a3a5c;
  border-radius: 0 6px 6px 6px;
  padding: 16px;
}

.section-header {
  display: flex;
  align-items: baseline;
  gap: 16px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

h2 {
  font-size: 1.05rem;
  color: #1a3a5c;
}

.note {
  font-size: 0.8rem;
  color: #888;
  font-style: italic;
}

footer {
  text-align: right;
  font-size: 0.78rem;
  color: #999;
  margin-top: 12px;
}

.legend {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  border-left: 4px solid transparent;
}

.legend-item::before {
  content: '';
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.legend-safe       { background: #edf9f2; border-color: #27ae60; color: #1a6b3c; }
.legend-safe::before { background: #27ae60; }

.legend-relegate-1       { background: #fff8e6; border-color: #e67e22; color: #8a4e00; }
.legend-relegate-1::before { background: #e67e22; }

.legend-relegate-2       { background: #fdf0ee; border-color: #e74c3c; color: #8a1a0f; }
.legend-relegate-2::before { background: #e74c3c; }

@media (max-width: 600px) {
  header {
    flex-direction: column;
    align-items: flex-start;
    padding: 14px 16px;
    gap: 10px;
  }

  h1 { font-size: 1.15rem; }

  .refresh-btn {
    align-self: stretch;
    justify-content: center;
  }

  .tab {
    padding: 8px 12px;
    font-size: 0.82rem;
  }

  .tab-content {
    padding: 10px;
  }

  .legend {
    gap: 6px;
  }

  .legend-item {
    font-size: 0.72rem;
    padding: 3px 8px;
  }

  .section-header {
    flex-direction: column;
    gap: 4px;
  }

}

.pool-matches {
  margin-top: 20px;
}
</style>
