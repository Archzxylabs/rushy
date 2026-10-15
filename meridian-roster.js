/* Meridian identities mapped to existing combat and online protocol IDs. */
(() => {
  'use strict';
  const entries=[["yot","aster","Aster","arco","ROUTE MARSHAL","Coordinator / relay drones","#F6B544",["RELAY CHAIN","SIGNAL ANCHOR","LANE SHIFT","PRIORITY GRID"]],["mamio","moro","Moro","fenr","SKYBIKE RACER","Racer / skid hazards and aerial vaults","#EE8C45",["BOARD CHAIN","DRIFT SPARK","GRIND VAULT","REDLINE LAP"]],["benja","beacon","Beacon","solan","CROWD CONDUCTOR","Rally / shockwaves","#E7A63C",["FLAG CHAIN","RALLY STANDARD","CALL RESPONSE","STANDING OVATION"]],["toad","loom","Loom","edda","GLASS GUARDIAN","Defense / counter & summon","#75CDBB",["SHIELD CHAIN","PRISM POST","REFRACT WALL","GLASS MAZE"]],["ping","vesper","Vesper","naja","NIGHT PATHFINDER","Ribbon / long reach","#C9669B",["RIBBON CHAIN","THREAD NEEDLE","BACKSTITCH","NIGHT WEAVE"]],["novee","kite","Kite","cora","AERIAL MECHANIC","Zoner / drone swarm","#A2D34E",["WING CHAIN","ROTOR TAG","CROSSWIND","AIR TRAFFIC"]],["tonashiro","iona","Iona","isolde","GLACIER COURIER","Lance / falling strikes","#91C4DC",["LANCE CHAIN","GLACIAL PIN","SLED CHARGE","WHITEOUT ROUTE"]],["bigchog","brink","Brink","haldor","DOCK WORKER","Heavy / ground control","#E9A243",["GAUNTLET CHAIN","CARGO HOOK","PILE DRIVER","CRANE DROP"]],["rogue","nix","Nix","zanni","BAZAAR MURALIST","Trickster / disc & tether","#EF6D87",["DISC CHAIN","COLOR BOMB","MASK SWAP","MURAL FLOOD"]],["tabsu","torque","Torque","mira","FOUNDRY ENGINEER","Barrage / micro rockets","#E89755",["GAUNTLET CHAIN","MAGNET MINE","PRESSURE VENT","FOUNDRY OVERLOAD"]],["venty","vela","Vela","nib","MAG-SKATE COURIER","Rushdown / fast projectiles","#31C7CF",["DISC CHAIN","RICOCHET DISC","CHECKPOINT BLINK","ACROSS TOWN"]],["cookie","orbit","Orbit","rhea","GRAVITY CARTOGRAPHER","Control / orbital field","#B997DB",["ORB CHAIN","GRAVITY TAG","ORBIT PIVOT","SINGULARITY"]]];
  const characters=entries.map(([id,slug,displayName,kit,title,style,color,names])=>({
    id,slug,displayName,kit,name:displayName.toUpperCase(),title,tag:title,style,color,names,
    race:'Meridian',detail:style,basic:names[0],ultimate:names[3],
    reference:'assets/meridian/characters/'+slug+'.webp',
    art:'assets/meridian/fighters/'+slug+'/ui/select.webp',
    portrait:'assets/meridian/fighters/'+slug+'/ui/'+(id==='mamio'?'portrait-base':'portrait')+'.webp'
  }));
  const byId=Object.fromEntries(characters.map(c=>[c.id,c]));
  const bySlug=Object.fromEntries(characters.map(c=>[c.slug,c]));
  const byKit=Object.fromEntries(characters.map(c=>[c.kit,c]));
  function get(id){return byId[id]||bySlug[id]||byKit[id];}
  function fighterInfo(id,form){
    const c=get(id);if(!c)throw new Error('Unknown Meridian fighter: '+id);
    const empowered=c.id==='mamio'&&form==='wolf',base='assets/meridian/fighters/'+c.slug+'/ui/';
    const icons=['basic','skill1','skill2','ultimate'].map((slot,i)=>i===0
      ? base+'icon-'+(c.id==='mamio'?(empowered?'empowered':'base')+'-':'')+slot+'.webp'
      : 'assets/meridian/abilities/'+c.slug+'/'+slot+'.webp');
    return {...c,cls:empowered?'OVERDRIVE':'MERIDIAN',deck:c.name+(empowered?' · OVERDRIVE':''),
      portrait:c.id==='mamio'?base+'portrait-'+(empowered?'empowered':'base')+'.webp':c.portrait,
      names:c.names,icons};
  }
  window.CHOG=Object.freeze({characters,byId,bySlug,byKit,get,fighterInfo,
    kit:id=>get(id)?.kit||id,id:kit=>get(kit)?.id||kit});
})();
