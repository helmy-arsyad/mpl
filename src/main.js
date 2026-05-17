import './style.css';
import { initializeApp } from 'firebase/app';

import { getDatabase, ref, onValue, set } from 'firebase/database';
import { TEAMS, INITIAL_MATCHES } from './constants.js';
import * as lucide from 'lucide';

const { createIcons, icons } = lucide;

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyCKEzWLnRVt-JoSAB7jd2kbdtWeOy-z8JA",
  authDomain: "mpl-id-7e5ec.firebaseapp.com",
  databaseURL: "https://mpl-id-7e5ec-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "mpl-id-7e5ec",
  storageBucket: "mpl-id-7e5ec.firebasestorage.app",
  messagingSenderId: "967812870494",
  appId: "1:967812870494:web:d4f1effc746341d7379fcf",
  measurementId: "G-6YNMHT6L3X"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- State Management ---
let state = {
  activeTab: 'regular',
  activeWeek: 1,
  matches: {},
  playoffScores: {},
  status: "Broadcasting Live"
};

const setState = (newState) => {
  state = { ...state, ...newState };
  render();
};

// --- Firebase Sync ---
const matchesRef = ref(db, 'matches');
const playoffRef = ref(db, 'playoff');

onValue(matchesRef, (snapshot) => {
  setState({ matches: snapshot.val() || {} });
});

onValue(playoffRef, (snapshot) => {
  setState({ playoffScores: snapshot.val() || {} });
});

// --- Actions ---
window.handleUpdate = async (id, side, val) => {
  const current = state.matches[id] || { leftScore: 0, rightScore: 0 };
  const updates = {};
  const boundedVal = Math.max(0, Math.min(2, val));
  if (side === 'left') updates.leftScore = boundedVal;
  else updates.rightScore = boundedVal;
  await set(ref(db, `matches/${id}`), { ...current, ...updates });
};

window.handleUpdatePlayoff = async (id, side, val) => {
  const current = state.playoffScores[id] || { left: 0, right: 0 };
  const max = id === 'gf' ? 4 : 3;
  const newVal = Math.min(max, Math.max(0, val));
  const updates = side === 'left' ? { ...current, left: newVal } : { ...current, right: newVal };
  await set(ref(db, `playoff/${id}`), updates);
};

window.clearData = async () => {
    if (confirm("Clear all data?")) {
        await set(ref(db, 'matches'), {});
        await set(ref(db, 'playoff'), {});
    }
};

window.setActiveTab = (tab) => setState({ activeTab: tab });
window.setActiveWeek = (week) => setState({ activeWeek: week });

window.downloadFile = async (name) => {
    try {
        const path = (name === 'main.js' || name === 'constants.js') ? `/src/${name}` : `/${name}`;
        const res = await fetch(path);
        let text = await res.text();

        if (name === 'index.html') {
            text = text.replace('src="/src/main.js"', 'src="main.js"');
            // Adding a clear configuration comment for user
            text = text.replace('<title>', '<!-- Standalone Version -->\n    <title>');
        }
        if (name === 'main.js') {
            // Ensure local imports work reliably
            text = text.replace("from './constants.js'", "from './constants.js'");
        }

        const mime = name.endsWith('.js') ? 'text/javascript' : 'text/html';
        const blob = new Blob([text], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); 
        a.href = url; 
        a.download = name; 
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) { 
        alert("Gagal mengunduh file."); 
    }
};

// --- Logic ---
function getStandings() {
  const stats = {};
  Object.keys(TEAMS).forEach(id => stats[id] = { wins: 0, losses: 0, gameWins: 0, gameLosses: 0, id });
  
  const allMatchIds = Object.keys(state.matches);
  const currentMatches = INITIAL_MATCHES.map(m => ({
    ...m,
    ...(state.matches[m.matchId] || { leftScore: 0, rightScore: 0 })
  }));

  currentMatches.forEach(m => {
    const sA = m.leftScore || 0;
    const sB = m.rightScore || 0;
    
    if (sA === 0 && sB === 0) return;

    stats[m.teamA].gameWins += sA; stats[m.teamA].gameLosses += sB;
    stats[m.teamB].gameWins += sB; stats[m.teamB].gameLosses += sA;
    
    if (sA > sB) { stats[m.teamA].wins++; stats[m.teamB].losses++; }
    else if (sB > sA) { stats[m.teamB].wins++; stats[m.teamA].losses++; }
  });

  return Object.values(stats)
    .map(s => ({ ...s, logo: TEAMS[s.id].logo, diff: s.gameWins - s.gameLosses }))
    .sort((a, b) => b.wins - a.wins || b.diff - a.diff);
}

function getWinner(matchId, teams) {
  const score = state.playoffScores[matchId];
  if (!score) return null;
  // teams bisa null/TBD, jangan anggap otomatis tidak ada
  if (!teams || !teams[0] || !teams[1]) return null;
  if (score.left >= 3) return teams[0];
  if (score.right >= 3) return teams[1];
  return null;
}

function getWinnerGF(teams) {
  const score = state.playoffScores['gf'];
  if (!score) return null;
  if (!teams || !teams[0] || !teams[1]) return null;
  if (score.left >= 4) return teams[0];
  if (score.right >= 4) return teams[1];
  return null;
}

function getLoser(matchId, teams) {
  const score = state.playoffScores[matchId];
  if (!score) return null;
  if (!teams || !teams[0] || !teams[1]) return null;
  if (score.left >= 3) return teams[1];
  if (score.right >= 3) return teams[0];
  return null;
}

// --- Components ---
const MatchCard = (match) => {
  const teamA = TEAMS[match.teamA];
  const teamB = TEAMS[match.teamB];
  const fullMatch = { leftScore: 0, rightScore: 0, ...match, ...(state.matches[match.matchId] || {}) };

  return `
    <div class="glass-card p-5 group flex flex-col gap-4 relative overflow-hidden">
      <div class="absolute top-0 right-0 p-2 opacity-10">
        <i data-lucide="zap" class="text-brand-primary w-10 h-10"></i>
      </div>
      
      <div class="flex items-center justify-between gap-6 z-10">
        <div class="flex flex-col items-center gap-3 flex-1">
          <div class="w-16 h-16 bg-white/[0.05] rounded-2xl flex items-center justify-center p-3 border border-white/10 group-hover:border-brand-primary/30 transition-all">
            <img src="${teamA?.logo}" alt="${teamA?.name}" class="w-full h-full object-contain" />
          </div>
          <span class="text-[10px] font-black uppercase tracking-wider text-center text-white/60">${teamA?.name}</span>
        </div>

        <div class="flex flex-col items-center gap-2">
          <div class="flex items-center gap-4">
            <button onclick="handleUpdate('${match.matchId}', 'left', ${(fullMatch.leftScore || 0) + 1})" class="text-4xl font-black text-brand-primary hover:scale-110 transition-transform tabular-nums">${fullMatch.leftScore}</button>
            <div class="h-8 w-px bg-white/10 rotate-12"></div>
            <button onclick="handleUpdate('${match.matchId}', 'right', ${(fullMatch.rightScore || 0) + 1})" class="text-4xl font-black text-brand-primary hover:scale-110 transition-transform tabular-nums">${fullMatch.rightScore}</button>
          </div>
          <span class="text-[9px] font-black uppercase text-white/20 tracking-[0.3em]">VERSUS</span>
        </div>

        <div class="flex flex-col items-center gap-3 flex-1">
          <div class="w-16 h-16 bg-white/[0.05] rounded-2xl flex items-center justify-center p-3 border border-white/10 group-hover:border-brand-primary/30 transition-all">
            <img src="${teamB?.logo}" alt="${teamB?.name}" class="w-full h-full object-contain" />
          </div>
          <span class="text-[10px] font-black uppercase tracking-wider text-center text-white/60">${teamB?.name}</span>
        </div>
      </div>

      <div class="flex items-center justify-between pt-4 border-t border-white/[0.05] z-10">
        <div class="flex gap-4">
          <button onclick="handleUpdate('${match.matchId}', 'left', ${(fullMatch.leftScore || 0) - 1})" class="text-white/20 hover:text-brand-danger transition-colors"><i data-lucide="minus" class="w-3.5 h-3.5"></i></button>
          <button onclick="handleUpdate('${match.matchId}', 'right', ${(fullMatch.rightScore || 0) - 1})" class="text-white/20 hover:text-brand-danger transition-colors"><i data-lucide="plus" class="w-3.5 h-3.5"></i></button>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-1.5 h-1.5 rounded-full bg-brand-success animate-pulse"></div>
          <span class="text-[10px] font-bold text-white/40 uppercase tracking-widest">${match.day}</span>
        </div>
      </div>
    </div>
  `;
};

const BracketMatch = (round, teamA, teamB, scoreA, scoreB, matchId, isGrandFinal = false) => {
  const maxScore = isGrandFinal ? 4 : 3;
  const isWinnerA = scoreA >= maxScore;
  const isWinnerB = scoreB >= maxScore;

  return `
    <div class="bracket-match flex flex-col gap-2">
      <div class="flex items-center justify-between px-1">
        <span class="text-[8px] font-black text-white/30 uppercase tracking-widest">${round}</span>
        <span class="text-[8px] font-bold text-white/10 uppercase">BO${isGrandFinal ? 7 : 5}</span>
      </div>
      <div class="flex flex-col gap-1.5 p-1.5 glass-card border-white/5! rounded-2xl!">
        <div class="bracket-team-row ${isWinnerA ? 'winner' : ''} p-2!">
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 p-1 bg-white/5 rounded-lg flex items-center justify-center">
              ${teamA?.logo ? `<img src="${teamA.logo}" class="w-full h-full object-contain" />` : '<i data-lucide="help-circle" class="w-3 h-3 text-white/10"></i>'}
            </div>
            <div class="flex flex-col">
               <span class="text-[10px] font-black ${!teamA ? 'text-white/20' : 'text-white'}">${teamA?.id || "TBD"}</span>
            </div>
          </div>
          <div class="flex items-center gap-1.5">
             <button onclick="handleUpdatePlayoff('${matchId}', 'left', ${scoreA - 1})" class="w-5 h-5 flex items-center justify-center rounded-md bg-white/5 hover:bg-white/10 text-[10px] text-white/20 hover:text-white transition-all">-</button>
             <span class="text-xs font-black w-4 text-center tabular-nums ${isWinnerA ? 'text-brand-primary' : 'text-white/60'}">${scoreA}</span>
             <button onclick="handleUpdatePlayoff('${matchId}', 'left', ${scoreA + 1})" class="w-5 h-5 flex items-center justify-center rounded-md bg-white/5 hover:bg-white/10 text-[10px] text-white/20 hover:text-white transition-all">+</button>
          </div>
        </div>
        <div class="bracket-team-row ${isWinnerB ? 'winner' : ''} p-2!">
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 p-1 bg-white/5 rounded-lg flex items-center justify-center">
              ${teamB?.logo ? `<img src="${teamB.logo}" class="w-full h-full object-contain" />` : '<i data-lucide="help-circle" class="w-3 h-3 text-white/10"></i>'}
            </div>
            <div class="flex flex-col">
               <span class="text-[10px] font-black ${!teamB ? 'text-white/20' : 'text-white'}">${teamB?.id || "TBD"}</span>
            </div>
          </div>
          <div class="flex items-center gap-1.5">
             <button onclick="handleUpdatePlayoff('${matchId}', 'right', ${scoreB - 1})" class="w-5 h-5 flex items-center justify-center rounded-md bg-white/5 hover:bg-white/10 text-[10px] text-white/20 hover:text-white transition-all">-</button>
             <span class="text-xs font-black w-4 text-center tabular-nums ${isWinnerB ? 'text-brand-primary' : 'text-white/60'}">${scoreB}</span>
             <button onclick="handleUpdatePlayoff('${matchId}', 'right', ${scoreB + 1})" class="w-5 h-5 flex items-center justify-center rounded-md bg-white/5 hover:bg-white/10 text-[10px] text-white/20 hover:text-white transition-all">+</button>
          </div>
        </div>
      </div>
    </div>
  `;
};

// --- Render Loop ---
function render() {
  const appEl = document.getElementById('app');
  if (!appEl) return;

  const standings = getStandings();
  const top6 = standings.slice(0, 6);

  // Playoff Logic (BO5 for all, BO7 for Finals)
  // Ensure bracket has 6 teams before rendering Play-ins
  const qf1Teams = top6?.[3] && top6?.[4] ? [top6[3], top6[4]] : [null, null];
  const qf2Teams = top6?.[2] && top6?.[5] ? [top6[2], top6[5]] : [null, null]; // Match 2: 3rd vs 6th

  const wQF1 = getWinner('qf1', qf1Teams);
  const wQF2 = getWinner('qf2', qf2Teams);

  // Upper SF
  const usf1Teams = [top6?.[0], wQF1]; // 1st vs W-M1
  const usf2Teams = [top6?.[1], wQF2]; // 2nd vs W-M2
  
  const wUSF1 = getWinner('usf1', usf1Teams);
  const wUSF2 = getWinner('usf2', usf2Teams);
  const lUSF1 = getLoser('usf1', usf1Teams);
  const lUSF2 = getLoser('usf2', usf2Teams);

  // Finals R1
  const ufTeams = [wUSF1, wUSF2];
  const lr1Teams = [lUSF1, lUSF2]; // Lower R1: L-M3 vs L-M4
  
  const wUF = getWinner('uf', ufTeams);
  const lUF = getLoser('uf', ufTeams);
  const wLR1 = getWinner('lr1', lr1Teams);

  // Lower Final
  const lfTeams = [wLR1, lUF]; // L-Final: W-LR1 vs L-UpperFinal
  const wLF = getWinner('lf', lfTeams);

  // Grand Final
  const gfTeams = [wUF, wLF];
  const champion = getWinnerGF(gfTeams);


  const playoffResults = {
      qf1Teams, qf2Teams,
      usf1Teams, usf2Teams,
      ufTeams, lr1Teams,
      lfTeams, gfTeams,
      champion
  };

  appEl.innerHTML = `
    <div class="flex flex-col min-h-screen">
      <header class="sticky top-0 z-50 bg-[#05051a]/80 backdrop-blur-2xl border-b border-white/5 py-5 px-8">
        <div class="max-w-7xl mx-auto flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="relative">
              <div class="absolute inset-0 bg-brand-primary blur-lg opacity-20"></div>
              <img src="https://id-mpl.com/images/s14/logo/LOGO_MPL-ID-NEW-2024-400.webp" class="h-10 relative z-10" />
            </div>
            <div>
              <h1 class="text-xl font-black italic tracking-tighter uppercase leading-none">Season 17</h1>
              <p class="text-[10px] font-black text-brand-primary uppercase tracking-[0.4em] mt-1">Broadcast Terminal</p>
            </div>
          </div>

          <div class="flex bg-white/[0.05] p-1 rounded-2xl border border-white/[0.05]">
            <button onclick="setActiveTab('regular')" class="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${state.activeTab === 'regular' ? 'bg-brand-primary text-white shadow-xl shadow-brand-primary/20' : 'text-white/40 hover:text-white'}">Regular</button>
            <button onclick="setActiveTab('playoff')" class="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${state.activeTab === 'playoff' ? 'bg-brand-primary text-white shadow-xl shadow-brand-primary/20' : 'text-white/40 hover:text-white'}">Playoffs</button>
          </div>
        </div>
      </header>

      <main class="max-w-7xl mx-auto w-full p-8 flex-1">
        <div class="mb-10 flex items-center justify-between">
          <div class="flex items-center gap-4">
             <div class="flex items-center gap-2 px-3 py-1 bg-brand-primary/10 rounded-full border border-brand-primary/20">
                <div class="w-1.5 h-1.5 bg-brand-primary rounded-full animate-pulse"></div>
                <span class="text-[10px] font-black uppercase tracking-widest text-brand-primary">${state.status}</span>
             </div>
             <span class="text-white/10 font-bold">/</span>
             <span class="text-[10px] font-black uppercase tracking-widest text-white/40">${state.activeTab === 'regular' ? `Week ${state.activeWeek}` : 'Tournament Bracket'}</span>
          </div>
          
          <div class="flex gap-3">
             <button onclick="clearData()" title="Hapus Data" class="p-2 glass-card rounded-xl text-white/20 hover:text-brand-danger hover:border-brand-danger/30 transition-all"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
          </div>
        </div>

        ${state.activeTab === 'regular' ? `
          <div class="grid grid-cols-1 xl:grid-cols-12 gap-10">
            <div class="xl:col-span-5 flex flex-col gap-6">
              <div class="flex items-center justify-between px-2">
                <h3 class="text-sm font-black uppercase tracking-[0.3em] flex items-center gap-3">
                   <i data-lucide="layout-grid" class="text-brand-primary w-4 h-4"></i> Standings
                </h3>
                <span class="text-[10px] font-black text-white/20 uppercase tracking-widest">Update Realtime</span>
              </div>
              <div class="glass-card overflow-hidden">
                <table class="w-full">
                  <thead class="bg-white/[0.03]">
                    <tr>
                      <th class="pl-6 py-4 text-[9px] font-black text-white/20 uppercase text-left">Pos</th>
                      <th class="py-4 text-[9px] font-black text-white/20 uppercase text-left">Team</th>
                      <th class="py-4 text-[9px] font-black text-white/20 uppercase text-right">Match</th>
                      <th class="pr-6 py-4 text-[9px] font-black text-white/20 uppercase text-right">Game Diff</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/[0.03]">
                    ${standings.map((team, idx) => `
                      <tr class="group hover:bg-white/[0.02] transition-colors relative">
                        <td class="pl-6 py-4">
                           <span class="text-xs font-black italic ${idx < 6 ? 'text-brand-primary' : 'text-white/10'}">${idx + 1}</span>
                        </td>
                        <td class="py-4">
                          <div class="flex items-center gap-4">
                            <img src="${team.logo}" class="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]" />
                            <span class="text-xs font-black uppercase tracking-widest">${team.id}</span>
                            ${idx < 2 ? '<div class="px-1.5 py-0.5 bg-brand-primary/10 border border-brand-primary/30 rounded text-[8px] font-black text-brand-primary uppercase">Upper</div>' : (idx < 6 ? '<div class="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[8px] font-black text-white/40 uppercase">Playoff</div>' : '')}
                          </div>
                        </td>
                        <td class="py-4 text-right">
                           <div class="flex flex-col items-end gap-0.5">
                              <span class="text-xs font-black tabular-nums">${team.wins} - ${team.losses}</span>
                           </div>
                        </td>
                        <td class="pr-6 py-4 text-right">
                           <span class="text-xs font-black tabular-nums ${team.diff > 0 ? 'text-brand-success' : (team.diff < 0 ? 'text-brand-danger' : 'text-white/20')}">
                              ${team.diff > 0 ? `+${team.diff}` : team.diff}
                           </span>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
              <div class="flex gap-2 items-start p-4 bg-white/5 rounded-2xl border border-white/5">
                <i data-lucide="info" class="text-white/20 w-3.5 h-3.5 mt-0.5"></i>
                <p class="text-[10px] leading-relaxed text-white/40 font-medium">Top 2 tim mengamankan Upper Bracket. Peringkat 3-6 memperebutkan slot eliminasi di Quarterfinals. Peringkat 7-9 Tereliminasi.</p>
              </div>
            </div>

            <div class="xl:col-span-7 flex flex-col gap-6">
              <div class="overflow-x-auto flex gap-3 pb-2 no-scrollbar">
                ${[1,2,3,4,5,6,7,8,9].map(w => `
                  <button onclick="setActiveWeek(${w})" class="flex-none px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${state.activeWeek === w ? 'bg-brand-primary border-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'bg-white/5 border-white/5 text-white/40 hover:border-white/10'}">Week ${w}</button>
                `).join('')}
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                ${INITIAL_MATCHES.filter(m => m.week === state.activeWeek).map(m => MatchCard(m)).join('')}
              </div>
            </div>
          </div>
        ` : `
          <div class="flex flex-col items-start lg:items-center py-8 overflow-x-auto pb-60 bracket-container select-none">
            <div class="w-full overflow-x-auto">
              <div class="flex justify-start gap-6 sm:gap-16 px-4 sm:px-20 min-w-max items-start pt-4">
              
              
              <!-- STAGE 1: PLAY-INS (Upper Part) -->
              <div class="bracket-column">
                <div class="bracket-stage-title">
                  <span class="text-[9px] font-black uppercase tracking-[0.4em] text-white/20 mb-1 block">Stage 1</span>
                  <h3 class="text-xs font-black text-brand-primary uppercase italic">Play-ins</h3>
                </div>
                <div class="flex flex-col h-[600px] w-full">
                   <div class="h-[300px] flex flex-col justify-around py-4">
                      ${BracketMatch(
                        "Match 1",
                        playoffResults.qf1Teams?.[0],
                        playoffResults.qf1Teams?.[1],
                        state.playoffScores['qf1']?.left || 0,
                        state.playoffScores['qf1']?.right || 0,
                        'qf1'
                      )}
                      ${BracketMatch(
                        "Match 2",
                        playoffResults.qf2Teams?.[0],
                        playoffResults.qf2Teams?.[1],
                        state.playoffScores['qf2']?.left || 0,
                        state.playoffScores['qf2']?.right || 0,
                        'qf2'
                      )}
                   </div>
                   <div class="bracket-divider"></div>
                   <div class="h-[300px] flex items-center justify-center">
                      <!-- Empty Lower -->
                   </div>
                </div>
              </div>

              <!-- STAGE 2: UPPER SF -->
              <div class="bracket-column">
                <div class="bracket-stage-title">
                  <span class="text-[9px] font-black uppercase tracking-[0.4em] text-white/20 mb-1 block">Stage 2</span>
                  <h3 class="text-xs font-black text-white/60 uppercase italic">Upper SF</h3>
                </div>
                <div class="flex flex-col h-[600px] w-full">
                   <div class="h-[300px] flex flex-col justify-around py-4">
                      ${BracketMatch("Upper SF 1", playoffResults.usf1Teams[0], playoffResults.usf1Teams[1], state.playoffScores['usf1']?.left || 0, state.playoffScores['usf1']?.right || 0, 'usf1')}
                      ${BracketMatch("Upper SF 2", playoffResults.usf2Teams[0], playoffResults.usf2Teams[1], state.playoffScores['usf2']?.left || 0, state.playoffScores['usf2']?.right || 0, 'usf2')}
                   </div>
                   <div class="bracket-divider"></div>
                   <div class="h-[300px]">
                      <!-- Empty Lower -->
                   </div>
                </div>
              </div>

              <!-- STAGE 3: FINALS R1 -->
              <div class="bracket-column">
                <div class="bracket-stage-title">
                  <span class="text-[9px] font-black uppercase tracking-[0.4em] text-white/20 mb-1 block">Stage 3</span>
                  <h3 class="text-xs font-black text-white/60 uppercase italic">Finals R1</h3>
                </div>
                <div class="flex flex-col h-[600px] w-full">
                   <div class="h-[300px] flex items-center justify-center">
                      ${BracketMatch("Upper Final", playoffResults.ufTeams[0], playoffResults.ufTeams[1], state.playoffScores['uf']?.left || 0, state.playoffScores['uf']?.right || 0, 'uf')}
                   </div>
                   <div class="bracket-divider"></div>
                   <div class="h-[300px] flex items-center justify-center">
                      ${BracketMatch("Lower R1", playoffResults.lr1Teams[0], playoffResults.lr1Teams[1], state.playoffScores['lr1']?.left || 0, state.playoffScores['lr1']?.right || 0, 'lr1')}
                   </div>
                </div>
              </div>

              <!-- STAGE 4: LOWER FINAL -->
              <div class="bracket-column">
                <div class="bracket-stage-title">
                  <span class="text-[9px] font-black uppercase tracking-[0.4em] text-white/20 mb-1 block">Stage 4</span>
                  <h3 class="text-xs font-black text-white/60 uppercase italic">Lower Final</h3>
                </div>
                <div class="flex flex-col h-[600px] w-full">
                   <div class="h-[300px]">
                      <!-- Empty Upper -->
                   </div>
                   <div class="bracket-divider"></div>
                   <div class="h-[300px] flex items-center justify-center">
                      ${BracketMatch("Lower Final", playoffResults.lfTeams[0], playoffResults.lfTeams[1], state.playoffScores['lf']?.left || 0, state.playoffScores['lf']?.right || 0, 'lf')}
                   </div>
                </div>
              </div>

              <!-- STAGE 5: GRAND FINAL -->
              <div class="flex-none w-[380px] sm:w-[420px]">
                <div class="text-center mb-6">
                  <span class="text-[9px] font-black uppercase tracking-[0.4em] text-white/20 mb-1">Stage 5</span>
                  <h3 class="text-xs font-black text-brand-primary uppercase italic">Grand Final</h3>
                </div>
                <div class="glass-card p-4 sm:p-8 border-brand-primary/20! bg-brand-primary/5 h-[600px] flex flex-col justify-center">
                    <div class="bg-[#05051a]/95 rounded-3xl p-6 sm:p-10 flex flex-col items-center gap-6 sm:gap-10 relative overflow-hidden border border-white/5 shadow-2xl">
                        ${playoffResults.champion ? `
                          <div class="absolute inset-0 z-0 pointer-events-none">
                             <div class="w-full h-full bg-brand-primary/10 blur-[100px] rounded-full animate-pulse"></div>
                          </div>
                        ` : ''}

                        <div class="flex flex-col items-center relative z-10">
                           <div class="relative mb-2">
                              <i data-lucide="trophy" class="w-12 h-12 sm:w-16 sm:h-16 transition-all duration-700 ${playoffResults.champion ? 'text-brand-primary scale-125 drop-shadow-[0_0_20px_rgba(102,126,234,0.5)]' : 'text-white/10'}"></i>
                           </div>
                           <h2 class="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter text-transparent bg-clip-text bg-linear-to-b from-white to-white/30 leading-tight">Champions</h2>
                        </div>

                        <div class="flex items-center gap-4 sm:gap-8 w-full relative z-10">
                           <div class="flex flex-col items-center gap-4 flex-1">
                              <div class="w-16 h-16 sm:w-24 sm:h-24 bg-white/[0.02] border rounded-2xl sm:rounded-3xl flex items-center justify-center p-3 sm:p-5 shadow-2xl relative transition-all duration-500 ${ (state.playoffScores['gf']?.left || 0) >= 4 ? 'border-brand-primary bg-brand-primary/20 scale-105' : 'border-white/5' }">
                                 ${playoffResults.gfTeams[0] ? `
                                    <img src="${playoffResults.gfTeams[0].logo}" class="w-full h-full object-contain relative z-10 drop-shadow-lg" />
                                 ` : `
                                    <span class="text-[8px] sm:text-[9px] font-black text-white/10 uppercase text-center leading-tight">Winner<br/>Upper Final</span>
                                 `}
                              </div>
                              <span class="text-[8px] sm:text-[10px] font-black text-white/40 h-4 uppercase tracking-widest text-center">${playoffResults.gfTeams[0]?.id || "TBD"}</span>
                              <div class="flex items-center gap-1 sm:gap-2">
                                <button onclick="handleUpdatePlayoff('gf', 'left', ${(state.playoffScores['gf']?.left || 0) - 1})" class="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-md sm:rounded-lg bg-white/5 hover:bg-brand-danger/20 text-white/20 hover:text-white transition-all">-</button>
                                <span class="text-xl sm:text-3xl font-black tabular-nums ${ (state.playoffScores['gf']?.left || 0) >= 4 ? 'text-brand-primary' : 'text-white' }">${state.playoffScores['gf']?.left || 0}</span>
                                <button onclick="handleUpdatePlayoff('gf', 'left', ${(state.playoffScores['gf']?.left || 0) + 1})" class="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-md sm:rounded-lg bg-white/5 hover:bg-brand-primary/20 text-white/20 hover:text-white transition-all">+</button>
                              </div>
                           </div>

                           <div class="text-xl sm:text-2xl font-black italic text-white/5">VS</div>

                           <div class="flex flex-col items-center gap-4 flex-1">
                              <div class="w-16 h-16 sm:w-24 sm:h-24 bg-white/[0.02] border rounded-2xl sm:rounded-3xl flex items-center justify-center p-3 sm:p-5 shadow-2xl relative transition-all duration-500 ${ (state.playoffScores['gf']?.right || 0) >= 4 ? 'border-brand-primary bg-brand-primary/20 scale-105' : 'border-white/5' }">
                                 ${playoffResults.gfTeams[1] ? `
                                    <img src="${playoffResults.gfTeams[1].logo}" class="w-full h-full object-contain relative z-10 drop-shadow-lg" />
                                 ` : `
                                    <span class="text-[8px] sm:text-[9px] font-black text-white/10 uppercase text-center leading-tight">Winner<br/>Lower Final</span>
                                 `}
                              </div>
                              <span class="text-[8px] sm:text-[10px] font-black text-white/40 h-4 uppercase tracking-widest text-center">${playoffResults.gfTeams[1]?.id || "TBD"}</span>
                              <div class="flex items-center gap-1 sm:gap-2">
                                <button onclick="handleUpdatePlayoff('gf', 'right', ${(state.playoffScores['gf']?.right || 0) - 1})" class="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-md sm:rounded-lg bg-white/5 hover:bg-brand-danger/20 text-white/20 hover:text-white transition-all">-</button>
                                <span class="text-xl sm:text-3xl font-black tabular-nums ${ (state.playoffScores['gf']?.right || 0) >= 4 ? 'text-brand-primary' : 'text-white' }">${state.playoffScores['gf']?.right || 0}</span>
                                <button onclick="handleUpdatePlayoff('gf', 'right', ${(state.playoffScores['gf']?.right || 0) + 1})" class="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-md sm:rounded-lg bg-white/5 hover:bg-brand-primary/20 text-white/20 hover:text-white transition-all">+</button>
                              </div>
                           </div>
                        </div>

                        ${playoffResults.champion ? `
                          <div class="w-full pt-4 sm:pt-8 border-t border-white/5 flex flex-col items-center relative z-10 mt-auto">
                             <div class="flex items-center gap-3 sm:gap-5 px-4 sm:px-8 py-3 sm:py-4 bg-brand-primary/10 border border-brand-primary/30 rounded-2xl sm:rounded-3xl shadow-2xl animate-in fade-in zoom-in duration-500">
                               <img src="${playoffResults.champion.logo}" class="w-8 h-8 sm:w-10 sm:h-10 object-contain drop-shadow-[0_0_15px_rgba(102,126,234,0.5)]" />
                               <div class="flex flex-col">
                                 <span class="text-[9px] sm:text-[10px] font-black text-brand-primary uppercase tracking-[0.3em] mb-0.5">S17 Champion</span>
                                 <span class="text-lg sm:text-xl font-black tracking-tighter text-white uppercase italic leading-none">${playoffResults.champion.name}</span>
                               </div>
                             </div>
                          </div>
                        ` : `
                          <div class="w-full pt-4 sm:pt-8 border-t border-white/5 flex flex-col items-center relative z-10 mt-auto opacity-30 select-none">
                             <div class="flex flex-col items-center">
                                <span class="text-[8px] sm:text-[10px] font-black text-white/40 uppercase tracking-[0.4em] mb-1">S17 Champion</span>
                                <span class="text-xl sm:text-2xl font-black tracking-tighter text-white/20 uppercase italic">TBD</span>
                             </div>
                          </div>
                        `}
                    </div>
                </div>
              </div>
            </div>
          </div>
        `}
      </main>

      <footer class="py-12 border-t border-white/[0.05] bg-black/20 mt-20">
        <div class="max-w-7xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div class="flex items-center gap-4">
             <img src="https://id-mpl.com/images/s14/logo/LOGO_MPL-ID-NEW-2024-400.webp" class="h-8 opacity-20 grayscale" />
             <p class="text-[9px] font-bold text-white/10 uppercase tracking-[0.4em]">Official Terminal S17</p>
          </div>
          <div class="flex gap-8">
             <button onclick="downloadFile('index.html')" class="text-[9px] font-black uppercase tracking-widest text-white/20 hover:text-brand-primary transition-colors flex items-center gap-2">
                <i data-lucide="download" class="w-3 h-3"></i> index.html
             </button>
             <button onclick="downloadFile('main.js')" class="text-[9px] font-black uppercase tracking-widest text-white/20 hover:text-brand-primary transition-colors flex items-center gap-2">
                <i data-lucide="download" class="w-3 h-3"></i> main.js
             </button>
             <button onclick="downloadFile('constants.js')" class="text-[9px] font-black uppercase tracking-widest text-white/20 hover:text-brand-primary transition-colors flex items-center gap-2">
                <i data-lucide="download" class="w-3 h-3"></i> constants.js
             </button>
             <a href="#" class="text-[9px] font-black uppercase tracking-widest text-white/20 hover:text-brand-primary transition-colors">Privacy</a>
             <a href="#" class="text-[9px] font-black uppercase tracking-widest text-white/20 hover:text-brand-primary transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  `;

  createIcons({ icons });
}

// Initial Render
render();
