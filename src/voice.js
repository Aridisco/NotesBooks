import { P, ST } from './state.js';
import { $, cv, esc, uid } from './util.js';
import { cl, commit, tfit } from './render.js';
import { selIds } from './edit.js';
import { idbp } from './platform.js';
import { props } from './toolbar.js';
import { report } from './report.js';

/* live transcription + audio */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
let mr = null;
let vch = [];
let vfinal = '';
let recOn = false;
let recPage = '';
export const recBtn = () => '<button class="wb ' + (recOn ? 'on' : '') + '" data-a="rec" title="Voice transcription" aria-label="Voice transcription">🎙</button>';
$('#vlang').innerHTML = [['it-IT', 'Italiano'], ['en-US', 'English (US)'], ['en-GB', 'English (UK)'], ['es-ES', 'Español'], ['fr-FR', 'Français'], ['de-DE', 'Deutsch']].map(x => `<option value="${x[0]}">${x[1]}</option>`).join('');
export function togglePanel() {
  const h = $('#vbox');
  h.hidden = !h.hidden;
  if (!h.hidden) listRecs();
}
function vStart() {
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    $('#vtxt').textContent = 'Recording is not supported in this browser.';
    return;
  }
  navigator.mediaDevices.getUserMedia({
    audio: true
  }).then(st => {
    recOn = true;
    recPage = ST.S.cur;
    vfinal = '';
    vch = [];
    $('#vgo').textContent = '■ Stop';
    $('#vgo').classList.add('on');
    $('#vtxt').textContent = SR ? 'Listening…' : 'Recording audio (live transcription is not available in this browser)';
    mr = new MediaRecorder(st);
    mr.ondataavailable = e => {
      if (e.data.size) vch.push(e.data);
    };
    mr.onstop = () => {
      st.getTracks().forEach(t => t.stop());
      setTimeout(() => {
        const text = $('#vtxt').textContent,
          blob = new Blob(vch, {
            type: mr.mimeType || 'audio/webm'
          }),
          id = uid();
        idbp('audio', 'readwrite', s => s.put({
          id,
          page: recPage,
          ts: Date.now(),
          text,
          blob
        }, id)).then(listRecs).catch(() => {
          $('#vtxt').textContent += '\n(Could not save the audio on this device)';
        });
      }, 700);
    };
    mr.start(5000);
    if (SR) {
      rec = new SR();
      rec.lang = $('#vlang').value;
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = ev => {
        let it = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i];
          if (r.isFinal) vfinal += r[0].transcript.trim() + ' ';else it += r[0].transcript;
        }
        $('#vtxt').textContent = vfinal + it;
        $('#vtxt').scrollTop = 1e9;
      };
      rec.onend = () => {
        if (recOn) try {
          rec.start();
        } catch (e) {}
      };
      try {
        rec.start();
      } catch (e) {}
    }
    props();
  }).catch(() => {
    $('#vtxt').textContent = 'Microphone access was denied.';
  });
}
function vStop() {
  recOn = false;
  try {
    rec && rec.stop();
  } catch (e) {}
  try {
    mr && mr.state !== 'inactive' && mr.stop();
  } catch (e) {}
  $('#vgo').textContent = '● Record';
  $('#vgo').classList.remove('on');
  props();
}
$('#vgo').onclick = () => recOn ? vStop() : vStart();
function vInsert(text) {
  text = (text || '').trim();
  if (!text) return;
  const v = P().v,
    id = uid(),
    q = cl([(cv.clientWidth / 2 - v.x) / v.z - 180, (cv.clientHeight / 4 - v.y) / v.z]),
    e = {
      id,
      t: 'text',
      x: q[0],
      y: q[1],
      w: 0,
      h: 0,
      stroke: ST.stroke,
      fill: 'none',
      sw: ST.sw,
      seed: 1,
      text,
      fs: 20,
      bw: 360
    };
  tfit(e);
  P().els.push(e);
  selIds([id]);
  commit();
  props();
}
$('#vadd').onclick = () => vInsert($('#vtxt').textContent);
function listRecs() {
  idbp('audio', 'readonly', s => s.getAll()).then(all => {
    const mine = (all || []).filter(r => r.page === ST.S.cur).sort((a, b) => b.ts - a.ts);
    $('#vlist').innerHTML = mine.map(r => {
      const u = URL.createObjectURL(r.blob);
      return `<div class="binrow"><div class="nm"><b>${new Date(r.ts).toLocaleString()}</b><small>${esc((r.text || '').slice(0, 80))}</small><audio controls src="${u}"></audio></div><a class="b" download="lecture-${r.id}.webm" href="${u}" title="Download audio">⬇</a><button class="b" data-rt="${r.id}" title="Add transcript to page" aria-label="Add transcript to page">T</button><button class="b" data-rd="${r.id}" title="Delete" aria-label="Delete">×</button></div>`;
    }).join('') || '<small style="color:var(--mut)">No recordings for this page yet</small>';
    $('#vlist')._r = mine;
  }).catch(e => report(e, 'Recordings could not be listed', { quiet: true }));
}
$('#vlist').onclick = e => {
  const b = e.target.closest('button');
  if (!b) return;
  const m = $('#vlist')._r || [];
  if (b.dataset.rt) {
    const r = m.find(x => x.id === b.dataset.rt);
    if (r) vInsert(r.text);
  }
  if (b.dataset.rd) idbp('audio', 'readwrite', s => s.delete(b.dataset.rd)).then(listRecs);
};
