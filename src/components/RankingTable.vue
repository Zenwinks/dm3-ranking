<script setup>
const props = defineProps({
  teams: { type: Array, required: true },
  showPool: { type: Boolean, default: false },
  zones: { type: Array, default: () => [] },
  highlightTeam: { type: String, default: '' },
})

function getRowClass(index) {
  if (!props.zones.length) return index % 2 === 1 ? 'row-alt' : ''
  let cumulative = 0
  const classes = ['zone-safe', 'zone-relegate-1', 'zone-relegate-2']
  for (let i = 0; i < props.zones.length; i++) {
    cumulative += props.zones[i].count
    if (index < cumulative) return classes[i] || ''
  }
  return classes[props.zones.length] || ''
}

// Returns the label for the separator that should appear BEFORE row at index
function getSeparatorLabel(index) {
  if (!props.zones.length) return null
  let cumulative = 0
  for (const zone of props.zones) {
    cumulative += zone.count
    if (index === cumulative) return zone.label
  }
  return null
}

const colCount = (col) => props.showPool ? 10 : 9
</script>

<template>
  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th class="col-pos">Pos</th>
          <th v-if="showPool" class="col-pool">Poule</th>
          <th class="col-name">Équipe</th>
          <th class="col-num" title="Points">Pts</th>
          <th class="col-num" title="Matchs joués">Jm</th>
          <th class="col-num" title="Victoires">V</th>
          <th class="col-num" title="Défaites">D</th>
          <th class="col-num" title="Différence de paniers">+/-</th>
          <th class="col-num" title="Paniers marqués">PM</th>
          <th class="col-num" title="Paniers encaissés">PE</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="(team, index) in teams" :key="team.nom">
          <!-- Zone separator row inserted BEFORE the first row of a new zone -->
          <tr v-if="getSeparatorLabel(index)" class="zone-separator-row">
            <td :colspan="colCount()" class="zone-separator-cell" :class="getRowClass(index) + '-sep'">
              {{ getSeparatorLabel(index) }}
            </td>
          </tr>

          <tr :class="[getRowClass(index), { 'row-mine': team.nom === highlightTeam }]">
            <td class="col-pos">
              <span class="pos-badge" :class="getRowClass(index)">{{ index + 1 }}</span>
            </td>
            <td v-if="showPool" class="col-pool">
              {{ team.poolName }}
              <span class="pool-rank">{{ team.position }}{{ team.position === 1 ? 'er' : 'è' }}</span>
            </td>
            <td class="col-name">
              <span v-if="team.nom === highlightTeam" class="mine-marker">▶</span>
              {{ team.nom }}
              <span v-if="team.tag === 'top3'" class="tag tag-top3" title="2e meilleur 3ème">3è↑</span>
              <span v-if="team.tag === 'top5'" class="tag tag-top5" title="2e meilleur 5ème">5è↑</span>
            </td>
            <td class="col-num bold">{{ team.points }}</td>
            <td class="col-num">{{ team.matchJoues }}</td>
            <td class="col-num stat-win">{{ team.gagnes }}</td>
            <td class="col-num stat-loss">{{ team.perdus }}</td>
            <td class="col-num" :class="team.paniersMarques - team.paniersEncaisses >= 0 ? 'stat-win' : 'stat-loss'">
              {{ team.paniersMarques - team.paniersEncaisses > 0 ? '+' : '' }}{{ team.paniersMarques - team.paniersEncaisses }}
            </td>
            <td class="col-num">{{ team.paniersMarques }}</td>
            <td class="col-num">{{ team.paniersEncaisses }}</td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.table-wrapper { overflow-x: auto; }

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

thead tr {
  background: #1a3a5c;
  color: #fff;
}

th {
  padding: 10px 12px;
  text-align: center;
  font-weight: 600;
  white-space: nowrap;
}

td {
  padding: 8px 12px;
  border-bottom: 1px solid #e8edf2;
  white-space: nowrap;
}

.col-pos {
  width: 48px;
  padding: 4px 8px 4px 12px;
  text-align: center;
  vertical-align: middle;
}
.col-pool { text-align: center; width: 60px; font-weight: 600; color: #1a3a5c; line-height: 1.2; }
.pool-rank {
  display: block;
  font-size: 0.7rem;
  font-weight: 400;
  color: #888;
}
.col-name { text-align: left; min-width: 200px; }
.col-num { text-align: center; width: 52px; }

.row-alt { background: #f4f7fa; }
.bold { font-weight: 700; }
.stat-win { color: #1a7a3a; font-weight: 600; }
.stat-loss { color: #c0392b; font-weight: 600; }

/* ── Zone row backgrounds ── */
/* box-shadow inset au lieu de border-left : pas d'impact sur le layout */
.zone-safe        { background: #edf9f2; box-shadow: inset 4px 0 0 #27ae60; }
.zone-relegate-1  { background: #fff8e6; box-shadow: inset 4px 0 0 #e67e22; }
.zone-relegate-2  { background: #fdf0ee; box-shadow: inset 4px 0 0 #e74c3c; }

/* ── Position badge ── */
.pos-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-weight: 700;
  font-size: 0.82rem;
  line-height: 1;
  padding: 0;
  background: #d0d8e4;
  color: #333;
}
/* Both classes are on the same element, hence no space in selector */
.pos-badge.zone-safe        { background: #27ae60; color: #fff; }
.pos-badge.zone-relegate-1  { background: #e67e22; color: #fff; }
.pos-badge.zone-relegate-2  { background: #e74c3c; color: #fff; }

/* ── Zone separator ── */
.zone-separator-row td {
  padding: 0;
  border-bottom: none;
}
.zone-separator-cell {
  padding: 5px 12px !important;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-top: 2px dashed currentColor;
}
.zone-relegate-1-sep { background: #fff0cc; color: #b05f00; border-color: #e67e22; }
.zone-relegate-2-sep { background: #fddbd7; color: #a0261b; border-color: #e74c3c; }

/* ── Mon club ── */
.row-mine td {
  font-weight: 700;
}
.row-mine .col-name {
  color: #1a3a5c;
}
.mine-marker {
  color: #1a3a5c;
  font-size: 0.7rem;
  margin-right: 4px;
  vertical-align: middle;
}

/* ── Tags top 3è / top 5è ── */
.tag {
  display: inline-block;
  font-size: 0.62rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 10px;
  vertical-align: middle;
  margin-left: 5px;
  white-space: nowrap;
}
.tag-top3 { background: #c8f0d8; color: #0e5c2b; }
.tag-top5 { background: #fde8c0; color: #7a4400; }

@media (max-width: 600px) {
  .table-wrapper {
    -webkit-overflow-scrolling: touch;
  }

  table { font-size: 0.78rem; }

  th, td {
    padding: 6px 7px;
  }

  .col-pos { width: 34px; padding: 4px 6px 4px 10px; }
  .col-pool { width: 46px; }
  .col-name { min-width: 120px; }
  .col-num { width: 36px; }

  .pos-badge {
    width: 24px;
    height: 24px;
    font-size: 0.75rem;
  }

  .zone-separator-cell {
    font-size: 0.65rem;
  }
}
</style>
