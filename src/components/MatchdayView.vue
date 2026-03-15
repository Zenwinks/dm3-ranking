<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  journees: { type: Array, required: true },
  highlightTeam: { type: String, default: '' },
})

const selectedJournee = ref(null)

// Auto-select the current/next journée:
// - First journée that has at least one unplayed match, OR
// - The last journée with the most recent played match (if all are done)
function detectCurrentJournee(journees) {
  // Find the first journée with unplayed matches
  const upcoming = journees.find(j => j.matches.some(m => !m.played))
  if (upcoming) return upcoming.numero

  // All matches played — pick the last journée by date
  const now = Date.now()
  let best = journees[journees.length - 1]
  for (const j of [...journees].reverse()) {
    const dates = j.matches.filter(m => m.date).map(m => new Date(m.date).getTime())
    if (dates.length && Math.max(...dates) <= now) { best = j; break }
  }
  return best?.numero ?? journees[0]?.numero
}

watch(() => props.journees, (j) => {
  if (j.length > 0) {
    selectedJournee.value = detectCurrentJournee(j)
  }
}, { immediate: true })

const currentJournee = computed(() =>
  props.journees.find(j => j.numero === selectedJournee.value)
)

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// Group matches by day, then by time slot within each day
function matchesByDayAndTime(journee) {
  if (!journee) return []
  const byDay = {}
  for (const m of journee.matches) {
    const day = m.date ? m.date.split('T')[0] : 'unknown'
    ;(byDay[day] ??= []).push(m)
  }
  return Object.keys(byDay).sort().map(day => {
    const byTime = {}
    for (const m of byDay[day]) {
      const time = m.date ? formatTime(m.date) : ''
      ;(byTime[time] ??= []).push(m)
    }
    const timeSlots = Object.keys(byTime).sort().map(time => ({
      time,
      matches: byTime[time],
    }))
    return {
      day,
      label: day !== 'unknown' ? formatDate(day + 'T12:00:00') : '',
      timeSlots,
    }
  })
}

function isWinner(match, team) {
  if (!match.played) return false
  if (team === 1) return match.score1 > match.score2
  return match.score2 > match.score1
}

function isHighlight(match) {
  return props.highlightTeam &&
    (match.equipe1.nom === props.highlightTeam || match.equipe2.nom === props.highlightTeam)
}
</script>

<template>
  <div class="matchday-view" v-if="journees.length > 0">
    <h3 class="matchday-title">Matchs par journée</h3>

    <nav class="journee-tabs">
      <button
        v-for="j in journees"
        :key="j.numero"
        :class="['j-tab', { active: selectedJournee === j.numero }]"
        @click="selectedJournee = j.numero"
      >
        J{{ j.numero }}
      </button>
    </nav>

    <div v-if="currentJournee" class="journee-content">
      <div v-for="group in matchesByDayAndTime(currentJournee)" :key="group.day" class="day-group">
        <div v-if="group.label" class="day-separator">
          <span class="day-label">{{ group.label }}</span>
        </div>

        <div v-for="slot in group.timeSlots" :key="slot.time" class="time-group">
          <div v-if="slot.time" class="time-separator">
            <span class="time-label">{{ slot.time }}</span>
          </div>

          <div
            v-for="match in slot.matches"
            :key="match.id"
            class="match-card"
            :class="{ 'match-highlight': isHighlight(match) }"
          >
            <div class="match-teams">
              <span class="team team-home" :class="{ winner: isWinner(match, 1) }">
                {{ match.equipe1.nom }}
              </span>
              <span class="match-score" v-if="match.played">
                <span :class="{ winner: isWinner(match, 1) }">{{ match.score1 }}</span>
                <span class="score-sep"> - </span>
                <span :class="{ winner: isWinner(match, 2) }">{{ match.score2 }}</span>
              </span>
              <span class="match-score upcoming" v-else>À venir</span>
              <span class="team team-away" :class="{ winner: isWinner(match, 2) }">
                {{ match.equipe2.nom }}
              </span>
            </div>
            <div class="match-info" v-if="match.salle || match.ville">
              {{ match.salle }}<template v-if="match.salle && match.ville">, </template>{{ match.ville }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.matchday-view {
  display: flex;
  flex-direction: column;
}

.matchday-title {
  font-size: 0.95rem;
  color: #1a3a5c;
  margin-bottom: 10px;
}

/* ── Journée tab bar ── */
.journee-tabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.j-tab {
  padding: 5px 12px;
  border: 1px solid #d0d8e4;
  background: #f4f7fa;
  color: #555;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 600;
  transition: all 0.15s;
}
.j-tab:hover { background: #e4eaf1; }
.j-tab.active {
  background: #1a3a5c;
  color: #fff;
  border-color: #1a3a5c;
}

/* ── Journée content ── */
.journee-date {
  font-size: 0.8rem;
  color: #888;
  margin-bottom: 8px;
  font-style: italic;
}

.journee-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.day-group + .day-group {
  margin-top: 6px;
}

.day-separator {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}
.day-separator::before,
.day-separator::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #d0d8e4;
}
.day-label {
  font-size: 0.78rem;
  color: #1a3a5c;
  font-weight: 600;
  white-space: nowrap;
  text-transform: capitalize;
}

.time-group + .time-group {
  margin-top: 4px;
}

.time-separator {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.time-separator::before {
  content: '';
  width: 16px;
  height: 1px;
  background: #a8b8cc;
}
.time-separator::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e0e6ee;
}
.time-label {
  font-size: 0.74rem;
  color: #5a7a9a;
  font-weight: 600;
  white-space: nowrap;
}

/* ── Match cards ── */
.match-card {
  padding: 8px 14px;
  background: #f4f7fa;
  border-radius: 6px;
  border-left: 3px solid #d0d8e4;
}

.match-card.match-highlight {
  background: #e8f0fb;
  border-left-color: #1a3a5c;
}

.match-teams {
  display: flex;
  align-items: center;
  gap: 10px;
}

.team {
  flex: 1;
  font-size: 0.85rem;
  color: #333;
}

.team-home { text-align: right; }
.team-away { text-align: left; }

.team.winner {
  font-weight: 700;
  color: #1a7a3a;
}

.match-score {
  flex-shrink: 0;
  min-width: 70px;
  text-align: center;
  font-size: 1rem;
  font-weight: 700;
  color: #1a3a5c;
}

.match-score .winner {
  color: #1a7a3a;
}

.score-sep {
  color: #999;
  font-weight: 400;
}

.match-score.upcoming {
  font-size: 0.8rem;
  font-weight: 500;
  color: #888;
  font-style: italic;
}

.match-info {
  font-size: 0.72rem;
  color: #888;
  margin-top: 3px;
  text-align: center;
}

/* ── Mobile ── */
@media (max-width: 600px) {
  .j-tab {
    padding: 4px 9px;
    font-size: 0.76rem;
  }

  .match-teams {
    flex-direction: column;
    gap: 2px;
  }

  .team {
    text-align: center !important;
    font-size: 0.8rem;
  }

  .match-score {
    font-size: 0.9rem;
    min-width: auto;
  }

  .match-info {
    font-size: 0.68rem;
  }
}
</style>
