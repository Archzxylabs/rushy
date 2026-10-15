(() => {
  'use strict';
  const roster=window.CHOG.characters,grid=document.querySelector('#fighter-grid'),spotlight=document.querySelector('#fighter-spotlight');
  const stageCards=document.querySelector('#stage-cards');
  let active=roster.find(c=>c.slug==='vela')||roster[0];
  const escape=value=>String(value).replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  function show(c){
    active=c;
    for(const button of grid.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.fighter===c.id));
    spotlight.style.setProperty('--accent',c.color);
    spotlight.innerHTML=`<div class="spotlight-art"><img src="${c.reference}" alt="${escape(c.displayName)}" loading="lazy"><b>${String(roster.indexOf(c)+1).padStart(2,'0')} / 12</b></div><div class="spotlight-info"><span class="eyebrow">${escape(c.title)}</span><h3>${escape(c.displayName)}</h3><p>${escape(c.style)}</p><div class="move-list">${c.names.map((name,i)=>`<span><kbd>${['SPACE','I','O','P'][i]}</kbd>${escape(name)}</span>`).join('')}</div><a class="primary" href="play.html?fighter=${encodeURIComponent(c.id)}">PLAY AS ${escape(c.displayName).toUpperCase()} <span>↗</span></a></div>`;
  }
  grid.innerHTML=roster.map((c,i)=>`<button type="button" data-fighter="${c.id}" aria-pressed="false" style="--accent:${c.color}"><span>${String(i+1).padStart(2,'0')}</span><img src="${c.portrait}" alt="" loading="lazy"><b>${escape(c.displayName)}</b></button>`).join('');
  grid.addEventListener('click',event=>{const button=event.target.closest('button[data-fighter]');if(button)show(window.CHOG.byId[button.dataset.fighter]);});
  show(active);
  stageCards.innerHTML=Object.entries(window.MatchRules.stages).map(([id,stage],i)=>`<a href="play.html?stage=${id}" class="stage-card"><img src="${stage.image}" alt="${escape(stage.name)}" loading="lazy"><div><span>0${i+1} / ${escape(stage.time)}</span><h3>${escape(stage.name)}</h3><p>${escape(stage.tag)}</p></div><b>↗</b></a>`).join('');
})();
