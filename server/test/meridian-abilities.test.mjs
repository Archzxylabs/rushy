import test from 'node:test';
import assert from 'node:assert/strict';
import {createCombat,ROSTER} from '../../online/core.mjs';

const gaps={
  arco:[120,180],fenr:[85,120],solan:[85,85],edda:[85,85],
  naja:[85,85],cora:[85,85],isolde:[180,180],haldor:[85,85],
  zanni:[85,85],mira:[120,85],nib:[85,240],rhea:[85,85]
};

test('all 36 Meridian abilities start, cool down, and connect at a practical range',()=>{
  const names=new Set();
  for(const [character,kit] of Object.entries(ROSTER)){
    const spec=globalThis.MeridianAbilities.specFor(kit);
    assert.ok(spec,kit);
    for(const [index,slot,bit] of [[0,'skill1',32],[1,'skill2',64],[2,'ultimate',128]]){
      const name=spec.names[index];assert.ok(!names.has(name),name);names.add(name);
      const sim=createCombat({characters:[character,character],skipIntro:true});
      sim.actors[0].x=350;sim.actors[1].x=350+(slot==='ultimate'?120:gaps[kit][index]);
      sim.step([{bits:bit,seq:1},{bits:0,seq:1}]);
      assert.ok(sim.actors[0].action?.meridian,`${name} did not start`);
      assert.ok(Math.abs(sim.actors[0].cooldowns[slot]-spec.cd[index])<.03,`${name} cooldown`);
      for(let frame=0;frame<200;frame++)sim.step([{bits:0,seq:frame+2},{bits:0,seq:frame+2}]);
      const damage=200-sim.actors[1].hp;
      assert.ok(damage>0,`${name} never connected`);
      if(slot==='ultimate')assert.ok(damage>=45&&damage<=50,`${name} dealt ${damage}, expected a complete ultimate`);
      assert.ok(sim.actors[0].cooldowns[slot]<spec.cd[index],`${name} cooldown did not tick`);
    }
  }
  assert.equal(names.size,36);
});
