/* Rushy original ability rules. Shared by canvas play and the authoritative simulation. */
(() => {
  'use strict';
  const ROOT=globalThis;
  const ids={arco:'aster',fenr:'moro',solan:'beacon',edda:'loom',naja:'vesper',cora:'kite',isolde:'iona',haldor:'brink',zanni:'nix',mira:'torque',nib:'vela',rhea:'orbit'};
  const design={
    aster:{names:['SIGNAL ANCHOR','LANE SHIFT','PRIORITY GRID'],cd:[4.2,6.4,19],reach:[280,300],color:'#ffc453'},
    moro:{names:['DRIFT SPARK','GRIND VAULT','REDLINE LAP'],cd:[3.8,5.8,18],reach:[210,280],color:'#f29758'},
    beacon:{names:['RALLY STANDARD','CALL RESPONSE','STANDING OVATION'],cd:[4.6,6.2,20],reach:[310,300],color:'#ffd17d'},
    loom:{names:['PRISM POST','REFRACT WALL','GLASS MAZE'],cd:[4.1,6.6,21],reach:[270,190],color:'#a4eee0'},
    vesper:{names:['THREAD NEEDLE','BACKSTITCH','NIGHT WEAVE'],cd:[3.5,6.1,19],reach:[470,380],color:'#ee8ec0'},
    kite:{names:['ROTOR TAG','CROSSWIND','AIR TRAFFIC'],cd:[4.0,5.8,20],reach:[540,260],color:'#c8ef78'},
    iona:{names:['GLACIAL PIN','SLED CHARGE','WHITEOUT ROUTE'],cd:[4.1,6.3,20],reach:[300,300],color:'#bceaff'},
    brink:{names:['CARGO HOOK','PILE DRIVER','CRANE DROP'],cd:[4.3,6.5,21],reach:[410,190],color:'#ffba76'},
    nix:{names:['COLOR BOMB','MASK SWAP','MURAL FLOOD'],cd:[3.9,6.2,19],reach:[440,430],color:'#ff88c4'},
    torque:{names:['MAGNET MINE','PRESSURE VENT','FOUNDRY OVERLOAD'],cd:[4.3,6.1,20],reach:[290,260],color:'#ffab66'},
    vela:{names:['RICOCHET DISC','CHECKPOINT BLINK','ACROSS TOWN'],cd:[3.5,5.9,18],reach:[620,400],color:'#7af4ef'},
    orbit:{names:['GRAVITY TAG','ORBIT PIVOT','SINGULARITY'],cd:[4.2,6.5,21],reach:[520,400],color:'#d5b5ff'}
  };
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const slugFor=kit=>ids[kit]||kit;
  const specFor=kit=>design[slugFor(kit)];
  const move=(actor,type)=>{const slug=slugFor(actor.kit),spec=design[slug],i=type==='skill1'?0:type==='skill2'?1:2;
    if(!spec)throw Error('Unknown Meridian kit: '+actor.kit);
    return {type,name:type,duration:[.54,.66,.5][i],hitAt:[.48,.52,0][i],damage:[16,24,0][i],knockback:[145,220,0][i],reach:spec.reach[Math.min(i,1)],projectile:['vesper','kite','brink','nix','vela','orbit'].includes(slug)&&i===0,meridian:true};
  };
  function createEngine({actors,config,projectiles,effects,hit,event=()=>{}}){
    let hazards=[],ultimates=[],markers=[null,null],serial=0;
    const owner=seat=>seat===0?'player':'enemy';
    const art=(slug,slot,x,y,size,life=.5,seat=0,extra={})=>effects.push({type:'meridian-fx',asset:`meridian-${slug}-${slot}`,x,y,size,life,maxLife:life,owner:owner(seat),facing:actors[seat].facing,...extra});
    const telegraph=(seat,x,radius,life,color)=>effects.push({type:'meridian-telegraph',x,y:config.groundY-4,radius,life,maxLife:life,color,owner:owner(seat)});
    const damage=(seat,x,radius,amount,power,color,opts={})=>{
      const a=actors[seat],target=actors[1-seat];
      if(Math.abs(target.x-x)>radius||Math.abs(target.y-config.groundY)>(opts.height??170))return false;
      const done=hit(seat,1-seat,{damage:amount,power,color,sourceX:x,impactY:target.y-94,knockdown:!!opts.knockdown,freeze:opts.freeze!==false,shake:opts.shake??1,pierce:!!opts.pierce});
      if(done&&opts.pull)target.x=clamp(target.x+(x-target.x)*opts.pull,70,1210);
      return !!done;
    };
    const burst=(seat,slug,slot,x,radius,amount,power,opts={})=>{
      const spec=design[slug];art(slug,slot,x,opts.y??config.groundY-105,opts.size??radius*2,opts.life??.48,seat);
      return damage(seat,x,radius,amount,power,spec.color,opts);
    };
    const trap=(seat,slug,x,delay,radius,amount,opts={})=>{
      hazards.push({id:++serial,seat,slug,x,t:0,delay,radius,amount,opts});
      telegraph(seat,x,radius,delay,design[slug].color);
    };
    const bolt=(seat,slug,x,y,speed,damageValue,opts={})=>{
      const a=actors[seat];
      projectiles.push({meridian:true,slug,seat,owner:owner(seat),asset:`meridian-${slug}-skill1`,x,y,vx:a.facing*speed,vy:opts.vy||0,gravity:opts.gravity||0,life:opts.life||1.5,facing:a.facing,damage:damageValue,knockback:opts.power||145,size:opts.size||80,radius:opts.radius||43,behavior:opts.behavior||'plain',bounces:opts.bounces||0,color:design[slug].color});
      art(slug,'skill1',x,y,opts.size||85,.22,seat);
    };
    function start(actor,type){
      const seat=actors.indexOf(actor),slug=slugFor(actor.kit),spec=design[slug];
      if(seat<0||!spec)throw Error('Meridian ability actor or kit is missing');
      if(!['skill1','skill2','ultimate'].includes(type)||actor.action||(actor.cooldowns[type]||0)>0||type==='ultimate'&&ultimates.some(u=>u.seat===seat))return false;
      const m=move(actor,type);actor.cooldowns[type]=spec.cd[type==='skill1'?0:type==='skill2'?1:2];
      actor.action={...m,t:0,fired:false,queued:0};actor.runDirection=0;
      if(type==='ultimate')ultimate(seat);
      return true;
    }
    function strike(seat,action){
      if(action.type!=='skill1'&&action.type!=='skill2')return false;
      const a=actors[seat],target=actors[1-seat],slug=slugFor(a.kit),f=a.facing,forward=x=>clamp(a.x+f*x,75,1205);
      if(action.type==='skill1'){
        switch(slug){
          case 'aster':trap(seat,slug,forward(210),.42,92,18);break;
          case 'moro':a.x=forward(105);trap(seat,slug,a.x-f*55,.22,110,17,{size:220});break;
          case 'beacon':{const x=forward(180);for(const d of [.25,.78,1.32])trap(seat,slug,x,d,116,17,{size:190});break;}
          case 'loom':trap(seat,slug,forward(155),.48,85,19,{size:175});break;
          case 'vesper':bolt(seat,slug,forward(75),a.y-105,1030,16,{size:105,behavior:'pull',radius:38});break;
          case 'kite':bolt(seat,slug,forward(75),a.y-170,840,12,{size:88,behavior:'tag',radius:43});break;
          case 'iona':trap(seat,slug,forward(215),.38,82,20,{size:175,knockdown:true});break;
          case 'brink':bolt(seat,slug,forward(80),a.y-95,930,15,{size:120,behavior:'hook',radius:44});break;
          case 'nix':bolt(seat,slug,forward(60),a.y-155,690,17,{vy:-320,gravity:1200,life:1.2,size:100,behavior:'splash',radius:62});break;
          case 'torque':trap(seat,slug,forward(215),.7,108,20,{size:200});break;
          case 'vela':bolt(seat,slug,forward(80),a.y-105,1070,15,{size:96,behavior:'ricochet',bounces:1,radius:40,life:2.2});break;
          case 'orbit':bolt(seat,slug,forward(75),a.y-100,800,13,{size:100,behavior:'pull',radius:52});break;
        }
      }else{
        switch(slug){
          case 'aster':{const old=a.x;a.x=forward(265);art(slug,'skill2',(old+a.x)/2,a.y-110,290,.43,seat);damage(seat,a.x,115,24,195,design[slug].color);break;}
          case 'moro':a.x=forward(230);a.y-=25;a.vy=-470;a.grounded=false;burst(seat,slug,'skill2',a.x,116,23,220,{y:a.y-90,size:245});break;
          case 'beacon':burst(seat,slug,'skill2',forward(180),105,18,160,{size:220});burst(seat,slug,'skill2',forward(350),105,18,160,{size:220});break;
          case 'loom':a.invuln=Math.max(a.invuln||0,.72);burst(seat,slug,'skill2',a.x+f*65,145,18,160,{size:300});break;
          case 'vesper':burst(seat,slug,'skill2',forward(220),205,23,130,{size:400,pull:.52});break;
          case 'kite':burst(seat,slug,'skill2',forward(170),135,24,150,{y:config.groundY-185,size:280,knockdown:true,height:380});break;
          case 'iona':a.x=forward(250);burst(seat,slug,'skill2',a.x,128,25,220,{size:300});break;
          case 'brink':burst(seat,slug,'skill2',forward(80),148,26,300,{size:330,knockdown:true});break;
          case 'nix':{const before=a.x;if(Math.abs(target.x-a.x)<440){const behind=target.x+f*76,room=behind>=90&&behind<=1190;a.x=clamp(room?behind:target.x-f*76,70,1210);a.facing=room?-f:f;}art(slug,'skill2',before,a.y-100,220,.45,seat);burst(seat,slug,'skill2',a.x,88,22,130,{size:190});break;}
          case 'torque':burst(seat,slug,'skill2',forward(130),170,23,330,{size:350});break;
          case 'vela':{const old=a.x,back=markers[seat];markers[seat]=old;a.x=back!==null?clamp(back,70,1210):forward(290);art(slug,'skill2',old,a.y-100,175,.4,seat);burst(seat,slug,'skill2',a.x,100,22,160,{size:200});break;}
          case 'orbit':burst(seat,slug,'skill2',forward(190),205,21,100,{size:390,pull:.65});break;
        }
      }
      return true;
    }
    function ultimate(seat){
      const a=actors[seat],slug=slugFor(a.kit),target=actors[1-seat],x=clamp(target.x,160,1120);
      ultimates.push({id:++serial,seat,slug,x,t:0,next:0});
      telegraph(seat,x,slug==='brink'?155:260,.55,design[slug].color);
      art(slug,'ultimate',x,config.groundY-180,slug==='brink'?440:480,.6,seat);
      event('ultimate',{seat,kit:a.kit,slug});
    }
    function ultimatePulse(u,index){
      const {seat,slug,x}=u,a=actors[seat],target=actors[1-seat],f=a.facing;
      let px=x,range=130,amount=16,power=175,pull=0,knockdown=false;
      switch(slug){
        case 'aster':px=clamp(x+f*(index-1)*145,70,1210);range=220;break;
        case 'moro':px=clamp(x+f*(index-1)*135,70,1210);a.x=clamp(px-f*90,70,1210);range=205;break;
        case 'beacon':px=clamp(x+f*(index-1)*190,70,1210);range=250;break;
        case 'loom':px=clamp(x+f*(index-1)*125,70,1210);range=195;break;
        case 'vesper':px=clamp(x+f*(index-1)*165,70,1210);range=230;pull=.25;break;
        case 'kite':px=clamp(x+f*(index-1)*155,70,1210);range=225;break;
        case 'iona':px=clamp(x+f*(index-1)*170,70,1210);range=235;break;
        case 'brink':if(index<2){telegraph(seat,x,155,.27,design[slug].color);return;}range=155;amount=48;power=350;knockdown=true;break;
        case 'nix':px=clamp(x+f*(index-1)*190,70,1210);range=250;break;
        case 'torque':px=clamp(x+f*(index-1)*150,70,1210);range=225;break;
        case 'vela':px=index===1?clamp(x-f*150,70,1210):clamp(x+f*145,70,1210);range=180;amount=index===2?14:17;break;
        case 'orbit':range=index===2?205:285;amount=index===2?30:9;pull=index===2?0:.36;knockdown=index===2;break;
      }
      const connected=burst(seat,slug,'ultimate',px,range,amount,power,{size:range*2.35,life:.58,pull,knockdown,y:config.groundY-140,height:360,pierce:!!u.confirmed});
      if(connected)u.confirmed=true;
    }
    function update(dt){
      for(let i=hazards.length-1;i>=0;i--){const h=hazards[i];h.t+=dt;if(h.t<h.delay)continue;
        burst(h.seat,h.slug,'skill1',h.x,h.radius,h.amount,145,{...h.opts,size:h.opts.size||h.radius*2,life:.5});
        hazards.splice(i,1);
      }
      for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i];if(!p.meridian)continue;
        const old=p.x;p.life-=dt;p.vy+=p.gravity*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
        if(p.behavior==='ricochet'&&p.bounces>0&&(p.x<85||p.x>1195)){p.x=clamp(p.x,85,1195);p.vx*=-1;p.facing*=-1;p.bounces--;}
        const target=actors[1-p.seat],within=p.x>=Math.min(old,p.x)-p.radius&&Math.abs(target.x-p.x)<=p.radius+43&&Math.abs(target.y-95-p.y)<100||target.x>=Math.min(old,p.x)-p.radius&&target.x<=Math.max(old,p.x)+p.radius&&Math.abs(target.y-95-p.y)<100;
        if(within&&hit(p.seat,1-p.seat,{damage:p.damage,power:p.knockback,color:p.color,sourceX:old,impactY:target.y-90,knockdown:false,freeze:true,shake:1})){
          art(p.slug,'skill1',p.x,p.y,p.size*1.5,.42,p.seat);
          if(p.behavior==='pull'||p.behavior==='hook')target.x=clamp(target.x+(actors[p.seat].x-target.x)*(p.behavior==='hook'?.36:.22),70,1210);
          if(p.behavior==='tag')trap(p.seat,p.slug,target.x,.34,90,9,{size:180});
          if(p.behavior==='ricochet'&&p.bounces>0){p.vx*=-1;p.facing*=-1;p.bounces=0;p.damage=8;p.life=Math.min(p.life,.7);continue;}
          projectiles.splice(i,1);continue;
        }
        if(p.behavior==='splash'&&p.y>=config.groundY-15){trap(p.seat,p.slug,p.x,.06,95,8,{size:190});projectiles.splice(i,1);continue;}
        if(p.life<=0||p.x<35||p.x>1245)projectiles.splice(i,1);
      }
      for(let i=ultimates.length-1;i>=0;i--){const u=ultimates[i];u.t+=dt;
        while(u.next<3&&u.t>=.62+u.next*.37){ultimatePulse(u,u.next);u.next++;}
        if(u.t>2.03)ultimates.splice(i,1);
      }
    }
    const snapshot=()=>structuredClone({hazards,ultimates,markers,serial});
    const restore=s=>{hazards=structuredClone(s?.hazards||[]);ultimates=structuredClone(s?.ultimates||[]);markers=structuredClone(s?.markers||[null,null]);serial=s?.serial||0;};
    return {start,strike,ultimate,update,snapshot,restore,hasUltimate:seat=>ultimates.some(u=>u.seat===seat),cutin:()=>ultimates.find(u=>u.t<.78)||null,reset:()=>restore(null)};
  }
  ROOT.MeridianAbilities=Object.freeze({ids,design,slugFor,specFor,move,createEngine});
})();
