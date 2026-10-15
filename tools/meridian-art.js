/* Rushy two-bone Canvas fighter rigs using original generated identity art.
   This renderer exports normalized, feet-anchored Meridian animation frames. */
(() => {
  'use strict';
  const designs = {
    aster:{height:184,head:[.36,.015,.29,.18],coat:'#172C55',trim:'#F6B544',pants:'#F0ECE4',boot:'#233149',headWidth:68,skin:'#B77D61',accessory:'relay'},
    moro:{height:176,head:[.37,.02,.27,.19],coat:'#F4EFE8',trim:'#EE8C45',pants:'#23304E',boot:'#243350',headWidth:68,skin:'#C79573',accessory:'board'},
    beacon:{height:184,head:[.36,.015,.28,.19],coat:'#D96F38',trim:'#F4C16D',pants:'#243252',boot:'#E8B065',headWidth:69,skin:'#AA6B4D',accessory:'flag'},
    loom:{height:188,head:[.36,.025,.28,.18],coat:'#D8E9DC',trim:'#75CDBB',pants:'#456B66',boot:'#A6C5AD',headWidth:73,skin:'#C3E4CC',accessory:'shield'},
    vesper:{height:184,head:[.39,.02,.25,.18],coat:'#9B355F',trim:'#E3A2BE',pants:'#392B48',boot:'#6A3655',headWidth:68,skin:'#D19A85',accessory:'whip'},
    kite:{height:178,head:[.36,.015,.28,.2],coat:'#243457',trim:'#A2D34E',pants:'#202C46',boot:'#E4E3D7',headWidth:67,skin:'#C29A76',accessory:'drone'},
    iona:{height:188,head:[.39,.01,.24,.19],coat:'#C7D5E5',trim:'#91C4DC',pants:'#455574',boot:'#D9E3EB',headWidth:69,skin:'#D4B4AA',accessory:'lance'},
    brink:{height:184,head:[.39,.02,.22,.17],coat:'#D87927',trim:'#F4B85C',pants:'#9A4D3A',boot:'#313C48',headWidth:69,skin:'#AD755F',accessory:'gauntlet'},
    nix:{height:178,head:[.38,.015,.28,.19],coat:'#B75B95',trim:'#EF6D87',pants:'#352D4B',boot:'#F0A6A0',headWidth:69,skin:'#C79B77',accessory:'disc'},
    torque:{height:185,head:[.38,.02,.24,.16],coat:'#D1D8E3',trim:'#E89755',pants:'#344A67',boot:'#E7E4D5',headWidth:66,skin:'#BD9073',accessory:'launcher'},
    vela:{height:179,head:[.39,.01,.27,.18],coat:'#16899C',trim:'#EF6D58',pants:'#E6E5DC',boot:'#243B52',headWidth:67,skin:'#C28F72',accessory:'disc'},
    orbit:{height:186,head:[.38,.01,.26,.19],coat:'#54407C',trim:'#D7B871',pants:'#392E57',boot:'#B697D5',headWidth:70,skin:'#9B7666',accessory:'orb'}
  };
  const images = {};
  const outline = '#172536';
  function path(ctx, points, fill, width=2.4) {
    ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();}if(width){ctx.strokeStyle=outline;ctx.lineWidth=width;ctx.lineJoin='round';ctx.stroke();}
  }
  function oval(ctx,x,y,rx,ry,fill,width=2.2) {
    ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();
    if(width){ctx.strokeStyle=outline;ctx.lineWidth=width;ctx.stroke();}
  }
  function stroke(ctx, points, color, width) {
    ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
    ctx.lineWidth=width+4;ctx.strokeStyle=outline;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();
    ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke();
  }
  function star(ctx,x,y,r,fill,n=5,inner=.5) {
    path(ctx,Array.from({length:n*2},(_,i)=>{const a=-Math.PI/2+i*Math.PI/n,s=i%2?r*inner:r;return [x+Math.cos(a)*s,y+Math.sin(a)*s];}),fill,1.8);
  }
  function head(ctx,id,d,bottom,offset=0,angle=0,empowered=false,expression='open') {
    const image=images[id];if(!image)return;
    const [nx,ny,nw,nh]=d.head, sx=nx*image.width,sy=ny*image.height,sw=nw*image.width,sh=nh*image.height;
    const width=d.headWidth,height=width*sh/sw;
    ctx.save();ctx.translate(offset,bottom-height*.48);ctx.rotate(angle);
    ctx.translate(-width/2,-height*.52);ctx.scale(width/sw,width/sw);
    if(d.polygon){ctx.beginPath();d.polygon.forEach(([x,y],i)=>{const px=x*image.width-sx,py=y*image.height-sy;i?ctx.lineTo(px,py):ctx.moveTo(px,py);});ctx.closePath();ctx.clip();}
    if(empowered){ctx.shadowColor='#fbe16d';ctx.shadowBlur=14;ctx.filter='saturate(1.3) brightness(1.08)';}
    ctx.drawImage(image,sx,sy,sw,sh,0,0,sw,sh);
    for(const eye of d.eyes||[]){
      const x=eye.x-sx,y=eye.y-sy,r=eye.r;
      if(expression==='blink'||expression==='ko'){
        ctx.fillStyle=eye.skin;ctx.beginPath();ctx.ellipse(x,y,r*1.22,r*1.25,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#24172f';ctx.lineWidth=r*.20;ctx.lineCap='round';
        ctx.beginPath();if(expression==='blink'){ctx.moveTo(x-r*.65,y);ctx.quadraticCurveTo(x,y+r*.2,x+r*.65,y);}else{ctx.moveTo(x-r*.48,y-r*.48);ctx.lineTo(x+r*.48,y+r*.48);ctx.moveTo(x+r*.48,y-r*.48);ctx.lineTo(x-r*.48,y+r*.48);}ctx.stroke();
      }else if(expression==='effort'){ctx.strokeStyle='#24172f';ctx.lineWidth=r*.16;ctx.beginPath();ctx.moveTo(x-r*.7,y-r*1.25);ctx.lineTo(x+r*.7,y-r*.85);ctx.stroke();}
    }
    ctx.restore();
  }
  function eyeAttachments(id){
    const image=images[id],d=designs[id],[nx,ny,nw,nh]=d.head,c=canvas(image.width,image.height),ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
    const w=image.width,h=image.height,pixels=ctx.getImageData(0,0,w,h).data,seen=new Uint8Array(w*h),parts=[];
    const x0=Math.floor((nx+nw*.15)*w),x1=Math.ceil((nx+nw*.88)*w),y0=Math.floor((ny+nh*.32)*h),y1=Math.ceil((ny+nh*.91)*h);
    const black=i=>pixels[i*4+3]>200&&pixels[i*4]+pixels[i*4+1]+pixels[i*4+2]<52;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const at=y*w+x;if(seen[at]||!black(at))continue;const stack=[at];seen[at]=1;let area=0,minX=x,maxX=x,minY=y,maxY=y;
      while(stack.length){const i=stack.pop(),px=i%w,py=Math.floor(i/w);area++;minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);for(const n of [i-1,i+1,i-w,i+w]){const xx=n%w,yy=Math.floor(n/w);if(xx>=x0&&xx<x1&&yy>=y0&&yy<y1&&!seen[n]&&black(n)){seen[n]=1;stack.push(n);}}}
      const ew=maxX-minX+1,eh=maxY-minY+1;if(area>120&&ew/eh>.55&&ew/eh<1.8&&ew<nw*w*.18){const cx=(minX+maxX)/2,cy=(minY+maxY)/2,sample=((Math.floor(cy)+Math.ceil(eh*.7))*w+Math.floor(cx))*4;parts.push({x:cx,y:cy,r:Math.max(ew,eh)/2,area,skin:`rgb(${pixels[sample]},${pixels[sample+1]},${pixels[sample+2]})`});}
    }
    parts.sort((a,b)=>b.area-a.area);const pair=parts.slice(0,2);
    if(pair.length===2&&Math.abs(pair[0].y-pair[1].y)<Math.max(pair[0].r,pair[1].r)*2.2)return pair;
    // Tilted/narrow eyes need explicit attachment anchors from the supplied artwork.
    const authored={loom:[[.431,.423,.033],[.647,.521,.027]],iona:[[.401,.468,.060],[.641,.463,.060]],nix:[[.336,.382,.021],[.471,.439,.021]]}[id];
    return (authored||[]).map(([x,y,r])=>({x:x*w,y:y*h,r:r*w,skin:'#fff7cd'}));
  }
  const profiles = {
    aster:{stance:1,lean:.02,bounce:.9,guard:-66,weight:1,height:212},
    moro:{stance:.88,lean:.065,bounce:1.3,guard:-65,weight:.96,height:208},
    beacon:{stance:1.07,lean:-.01,bounce:.9,guard:-60,weight:1.04,height:218},
    loom:{stance:1.15,lean:0,bounce:.4,guard:-76,weight:1.08,height:222},
    vesper:{stance:.9,lean:.04,bounce:1.1,guard:-78,weight:.94,height:214},
    kite:{stance:.9,lean:.06,bounce:1.2,guard:-61,weight:.95,height:212},
    iona:{stance:1.02,lean:-.02,bounce:.6,guard:-66,weight:1,height:222},
    brink:{stance:1.2,lean:0,bounce:.5,guard:-50,weight:1.18,height:225},
    nix:{stance:1.02,lean:.07,bounce:1.2,guard:-67,weight:.96,height:211},
    torque:{stance:1.13,lean:-.025,bounce:.6,guard:-67,weight:1.13,height:224},
    vela:{stance:.85,lean:.06,bounce:1.35,guard:-55,weight:.91,height:204},
    orbit:{stance:1,lean:-.03,bounce:1,guard:-69,weight:1,height:218}
  };
  function pose(state,frame,count,id='aster') {
    const persona=profiles[id];
    const t=count===1?0:frame/(count-1), phase=frame/count*Math.PI*2;
    const p={hip:-58,lean:0,bob:0,headAngle:0,feet:[[-15,0],[17,0]],hands:[[-25,-44],[43,-64]],turn:0,dx:0,dy:0,propAngle:0};
    if(state==='idle'){p.lean=persona.lean;p.bob=Math.sin(phase)*persona.bounce;p.hands[1][1]=persona.guard+Math.sin(phase)*1.5;p.feet.forEach(f=>f[0]*=persona.stance);p.headAngle=-persona.lean*.8;}
    if(state==='walk'||state==='run'){
      const fast=state==='run',s=Math.sin(phase),stride=fast?44:32,lift=fast?14:9;
      p.lean=fast?.08:.025;p.bob=-Math.abs(Math.cos(phase))*1.7;
      // The planted foot travels backwards through the contact half of the cycle.
      // This stride is exported to the runtime so world motion and contacts agree.
      const foot=(q,side)=>{q=(q+1)%1;return q<.5?[stride*(.5-q*2)+side*10,0]:[stride*(-.5+(q-.5)*2)+side*10,-Math.sin((q-.5)*Math.PI*2)*lift];};
      p.feet=[foot(frame/count,-1),foot(frame/count+.5,1)];
      p.hands=[[-23-s*18,-46],[27+s*18,-48]];
    }
    if(state==='jump'){const lift=[6,22,13,3][frame%4];p.feet=[[-24,-lift],[22,-lift-8]];p.hands=[[-37,-72-lift*.4],[43,-73-lift*.3]];p.lean=[.08,.04,-.01,-.04][frame%4];}
    if(state==='doublejump'){p.hip=-62;p.feet=[[-17,-51],[16,-49]];p.hands=[[-23,-66],[25,-70]];p.lean=.05;}
    if(state==='crouch'){p.hip=-14;p.feet=[[-28*persona.stance,0],[28*persona.stance,0]];p.hands=[[-24,-34],[38,-47]];p.lean=.08;}
    if(state.startsWith('attack')){
      const strike=frame===2?1:frame===1?.58:frame===3?.14:0,index=Number(state.slice(-1));
      p.lean=.07*strike;p.dx=strike*6;
      p.hands[1]=index===2?[35-5*strike,-62-85*strike]:[40+53*strike,-64-(index===3?24:8)*strike];
      p.hands[0]=[-28-8*strike,-49];p.propAngle=index===2?-1.1*strike:-.65+strike*.9;
      p.feet=[[-20,0],[24+strike*5,0]];
      p.headAngle=-strike*.06;
      if(id==='nix'){p.propAngle=-.9+strike*1.6;p.hands[1][1]+=index===1?strike*10:-strike*5;p.lean+=strike*.05;}
      if(id==='torque'){p.propAngle=-1.25+strike*1.5;p.hip-=3*strike;p.hands[1][1]-=12*(1-strike);p.lean-=.04*(1-strike);}
      if(id==='loom'){p.propAngle=-.35+strike*.65;p.hands[0]=[-18,-68];p.lean*=.4;}
      if(id==='brink'){p.propAngle=-.4+strike*.4;p.feet=[[-26,0],[29,0]];p.hip+=3*strike;}
      if(id==='beacon'||id==='orbit'){p.propAngle=-1.1+strike*.8;p.hands[0]=[-34-strike*12,-76];p.headAngle=strike*.06;}
      if(id==='iona'||id==='kite'){p.hands[0]=[-17,-64];p.hands[1][1]+=8;p.lean*=.6;}
      if(id==='vela'||id==='vesper'||id==='moro'){p.hip-=strike*3;p.headAngle=-strike*.1;p.lean+=strike*.035;}
    }
    if(state==='skill1'){const cast=frame===2?1:frame===1?.6:frame===3?.2:0;p.hands=[[-22,-61],[43+47*cast,-82]];p.propAngle=-Math.PI/2;}
    if(state==='skill2'){const cast=frame===2?1:frame===1?.5:frame===3?.15:0;p.lean=.12*cast;p.hands=[[-29,-68],[30+31*cast,-109+70*cast]];p.feet=[[-26,0],[28,0]];p.propAngle=cast*.8-.8;}
    if(state==='ultimate'){p.hands=[[-34,-98],[43,-115]];p.propAngle=-.6;p.bob=-Math.sin(t*Math.PI)*2;}
    if(state==='hurt'){p.lean=-.13*(1-t*.65);p.dx=-6*(1-t);p.hands=[[-39,-63],[27,-86]];p.headAngle=-.09*(1-t);}
    if(state==='down'){const a=[-.22,-.75,-Math.PI/2,-Math.PI/2][frame]||-Math.PI/2;p.turn=a;p.dx=26;p.dy=frame>1?-63:frame===1?-30:0;p.hands=[[-24,-49],[28,-64]];}
    if(state==='recover'){if(frame===0){p.turn=-Math.PI/2;p.dx=26;p.dy=-63;}else if(frame===1){p.hip=-14;p.lean=.18;p.feet=[[-27,0],[27,0]];}else if(frame===2){p.hip=-48;p.lean=.08;}}
    
    return p;
  }
  function chain(start,target,upper,lower,bend=1,stretch=1){
    const dx=target[0]-start[0],dy=target[1]-start[1],distance=Math.hypot(dx,dy)||.001;
    const reach=Math.min(distance,(upper+lower)*stretch-.01),ratio=reach/distance;
    const end=[start[0]+dx*ratio,start[1]+dy*ratio],u=upper*stretch,l=lower*stretch;
    const angle=Math.atan2(dy,dx)+bend*Math.acos(Math.max(-1,Math.min(1,(u*u+reach*reach-l*l)/(2*u*reach))));
    return {joint:[start[0]+Math.cos(angle)*u,start[1]+Math.sin(angle)*u],end};
  }
  function weapon(ctx,d,hand,angle,state) {
    const [x,y]=hand;
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    if(d.accessory==='board'){ctx.restore();return;}
    if(d.accessory==='relay'||d.accessory==='disc'){
      ctx.beginPath();ctx.ellipse(0,-31,d.accessory==='disc'?26:22,26,0,0,Math.PI*2);ctx.lineWidth=8;ctx.strokeStyle=d.trim;ctx.stroke();oval(ctx,0,-31,8,8,'#F4F0E6',1);ctx.restore();return;
    }
    if(d.accessory==='flag'){stroke(ctx,[[0,18],[0,-86]],'#F0ECE4',6);path(ctx,[[0,-83],[58,-76],[47,-34],[0,-38]],d.trim,2);ctx.restore();return;}
    if(d.accessory==='shield'){path(ctx,[[-27,-72],[25,-72],[23,13],[0,32],[-25,13]],d.trim,3);path(ctx,[[-18,-61],[18,-61],[17,6],[0,19],[-17,6]],'#D8E9DC',2);ctx.restore();return;}
    if(d.accessory==='drone'){path(ctx,[[-27,-27],[19,-27],[32,-5],[17,17],[-22,17],[-32,-4]],d.trim,2);oval(ctx,0,-5,9,9,'#D8E9DC',1);ctx.restore();return;}
    if(d.accessory==='gauntlet'){path(ctx,[[-20,-30],[24,-28],[31,9],[20,20],[-21,18],[-27,6]],d.trim,2);ctx.restore();return;}
    if(d.accessory==='launcher'){path(ctx,[[-25,-31],[19,-31],[32,-5],[19,20],[-25,20]],'#60768C',2);for(let k=-1;k<=1;k++)oval(ctx,24,k*12-5,5,5,d.trim,1);ctx.restore();return;}
    if(d.accessory==='orb'){oval(ctx,0,-39,24,24,d.trim,3);oval(ctx,-6,-45,7,7,'#F4F0E6',0);ctx.restore();return;}
    if(d.accessory==='brush'){
      stroke(ctx,[[0,20],[0,-61]],'#bd874f',7);path(ctx,[[-10,-58],[-11,-77],[0,-95],[11,-77],[9,-57]],'#e979af');
    }else if(d.accessory==='controller'){
      path(ctx,[[-27,-13],[20,-13],[30,8],[21,18],[-22,18],[-31,8]],'#7560b0');oval(ctx,-10,1,4,4,'#c9f578',1);oval(ctx,13,1,4,4,'#ffbe5b',1);stroke(ctx,[[18,-13],[24,-31]],'#c9f578',3);
    }else if(d.accessory==='keyboard'){
      path(ctx,[[-34,-19],[33,-19],[38,15],[-38,15]],'#ded2ee');for(let row=0;row<2;row++)for(let col=0;col<6;col++){ctx.fillStyle=(col+row)%2?'#c4a0e2':'#765596';ctx.fillRect(-29+col*10,-12+row*11,7,7);}
    }else if(d.accessory==='bonk'){
      stroke(ctx,[[0,16],[0,-53]],'#f4d37d',9);path(ctx,[[-25,-48],[-25,-76],[22,-76],[30,-63],[22,-48]],'#b8c6f3');
    }else if(d.accessory==='mic'){
      stroke(ctx,[[0,16],[0,-24]],'#b0a2d2',9);oval(ctx,0,-36,13,19,'#e3b456');for(let y=-47;y<-23;y+=7)stroke(ctx,[[-9,y],[9,y]],'#524257',2);
    }else if(d.accessory==='megaphone'){
      path(ctx,[[-14,-27],[31,-48],[40,-39],[40,-3],[31,4],[-14,-9]],'#ffd16a');oval(ctx,35,-22,5,22,'#f9eed2');stroke(ctx,[[0,-9],[4,10]],'#e5aa43',8);
    }else if(d.accessory==='sword'||d.accessory==='blade'){
      stroke(ctx,[[0,0],[0,-74]],'#c5cbdf',8);path(ctx,[[-7,-12],[-8,-66],[0,-88],[8,-66],[7,-12]],'#e1e5ee',2);
      stroke(ctx,[[-12,-8],[12,-8]],'#f3b940',5);stroke(ctx,[[0,-4],[0,13]],'#aa4826',7);
    }else if(['staff','lance','hammer','sign','whip'].includes(d.accessory)){
      stroke(ctx,[[0,27],[0,-72]],d.accessory==='staff'?'#685489':'#9a7086',5);
      if(d.accessory==='sign'){oval(ctx,0,-69,16,16,'#f2e7d5');oval(ctx,0,-69,12,12,'#e53151',1);stroke(ctx,[[-9,-79],[9,-59]],'#f5eadb',4);}
      if(d.accessory==='lance')path(ctx,[[-8,-66],[0,-99],[8,-66],[0,-56]],'#7de2ff');
      if(d.accessory==='staff')star(ctx,0,-75,15,'#72dcee');
      if(d.accessory==='hammer'){path(ctx,[[-23,-62],[-23,-84],[22,-84],[27,-73],[22,-62]],'#69657b');path(ctx,[[-15,-81],[16,-81],[16,-65],[-15,-65]],'#f5cf65',1.5);}
      if(d.accessory==='whip'){ctx.beginPath();ctx.moveTo(0,-70);ctx.bezierCurveTo(34,-96,45,-31,69,-66);ctx.strokeStyle=outline;ctx.lineWidth=5;ctx.stroke();ctx.strokeStyle='#eda8df';ctx.lineWidth=2.5;ctx.stroke();}
    }else if(d.accessory==='bugs'&&state==='ultimate')star(ctx,0,-9,13,'#f5aa39');
    ctx.restore();
  }
  function rawRender(ctx,id,state='idle',frame=0,count=4,empowered=false,bodyOnly=false) {
    const d=designs[id],p=pose(state,frame,count,id),size=d.bodyScale||d.height/180;
    ctx.save();ctx.translate(p.dx,p.dy);ctx.rotate(p.turn);ctx.scale(size,size);
    
    if(empowered){ctx.save();ctx.globalAlpha=.18;oval(ctx,0,-90,65,86,'#efd551',0);ctx.restore();}
    if(id==='moro'){oval(ctx,0,4,66,7,'#1B3853',2);oval(ctx,-29,4,9,6,'#EE8C45',1);oval(ctx,29,4,9,6,'#EE8C45',1);}
    if(d.accessory==='cape')path(ctx,[[-23,-78],[-47,-68],[-48,-17],[-15,-27],[16,-33]],empowered?'#e8b844':'#ce932d');
    for(let i=0;i<2;i++){
      const [fx,fy]=p.feet[i],hx=i?11:-11,leg=chain([hx,p.hip],[fx,fy-7],26,26,i?-1:1);
      stroke(ctx,[[hx,p.hip],leg.joint,[fx,fy-7]],d.pants,15*profiles[id].weight);
      ctx.save();ctx.translate(fx,fy-5);path(ctx,[[-10,-7],[8,-7],[13,0],[13,5],[-11,5],[-13,0]],d.boot,2.5);stroke(ctx,[[-8,1],[10,1]],'#d8d2e5',1.5);ctx.restore();
    }
    ctx.save();ctx.translate(p.lean*30,p.bob);ctx.rotate(p.lean);
    const top=p.hip-43;
    const left=chain([-19,top+10],p.hands[0],31,34,-1),right=chain([19,top+10],p.hands[1],31,34,1,state.startsWith('attack')&&frame===2?1.06:1);
    p.hands=[left.end,right.end];
    stroke(ctx,[[-19,top+10],left.joint,left.end],d.coat,15);oval(ctx,...p.hands[0],7,8,d.boot);
    path(ctx,[[-24,top+3],[19,top+3],[25,p.hip-1],[16,p.hip+5],[-20,p.hip+5],[-27,top+29]],d.coat);
    stroke(ctx,[[-19,p.hip],[19,p.hip]],d.trim,5);
    if(id==='beacon'){path(ctx,[[-20,top+3],[17,top+3],[13,top+13],[-14,top+13]],d.trim,1);stroke(ctx,[[4,p.hip+9],[4,p.hip+28]],'#bad4e3',2);}
    if(id==='aster'){stroke(ctx,[[0,top+8],[0,p.hip]],d.trim,3);oval(ctx,0,top+25,7,7,d.trim,1);}
    if(id==='brink'){path(ctx,[[-24,top+4],[24,top+4],[24,top+17],[-24,top+17]],'#F4B85C',1);}
    if(id==='loom'){path(ctx,[[-24,top+19],[-3,top+11],[18,top+21],[-6,top+27]],'#d4f1f5',0);stroke(ctx,[[0,top+10],[0,p.hip]],'#9fe7eb',2);}
    
    if(id==='vela'){stroke(ctx,[[-22,top+19],[22,top+19]],'#F0ECE4',4);}
    if(id==='torque'){path(ctx,[[-24,top+5],[-32,top-5],[-17,top-10],[-10,top+7]],'#587bcc');path(ctx,[[21,top+5],[29,top-5],[15,top-10],[9,top+7]],'#4d69c3');oval(ctx,0,top+22,11,11,'#74dafb');oval(ctx,0,top+22,6,6,'#b6f4ff',1);}
    if(id==='iona'){path(ctx,[[-19,top+14],[15,top+14],[15,p.hip-5],[-19,p.hip-5]],'#8db9cf',1.5);star(ctx,-2,top+28,9,'#17283f',7);}
    if(id==='nix'){path(ctx,[[-21,top-2],[20,top-2],[22,top+10],[-25,top+11]],'#e356a7',2);for(let n=-18;n<20;n+=7)stroke(ctx,[[n,top],[n,top+8]],'#b52e77',2);}
    if(id==='orbit')path(ctx,[[-19,top+6],[-30,p.hip+12],[-10,p.hip+8],[5,top+7]],'#91a7be',2);
    if(id==='vesper'){path(ctx,[[-20,top+3],[1,top+3],[-3,p.hip],[-22,p.hip]],'#e7a1d8',1.8);oval(ctx,0,p.hip-4,5,6,'#f1cc9f',1);}
    // Head/back attachments precede the front hand so grips remain visible.
    const expression=state==='down'?'ko':state==='hurt'||state.startsWith('attack')?'effort':state==='idle'&&count>4&&frame===count-2?'blink':'open';
    head(ctx,id,d,top+7,p.lean*7,p.headAngle,empowered,expression);
    if(state==='hurt'){ctx.fillStyle='#70d7ff';ctx.beginPath();ctx.ellipse(-d.headWidth*.44,top-18,3,7,-.4,0,Math.PI*2);ctx.fill();}
    stroke(ctx,[[19,top+10],right.joint,right.end],d.coat,15);
    if(d.accessory==='armor')oval(ctx,p.hands[1][0],p.hands[1][1],10,10,'#84b7ef');
    if(!bodyOnly)weapon(ctx,d,p.hands[1],p.propAngle,state);
    oval(ctx,...p.hands[1],7,8,d.boot);
    
    ctx.restore();
    ctx.restore();
  }
  const groundOffsets=new Map();
  function bounds(id,state,frame,count,empowered=false,bodyOnly=false){
    const c=canvas(1024,768),ctx=c.getContext('2d',{willReadFrequently:true});ctx.translate(512,580);rawRender(ctx,id,state,frame,count,empowered,bodyOnly);
    const data=ctx.getImageData(0,0,1024,768).data;let x0=1024,y0=768,x1=0,y1=0;
    for(let y=0;y<768;y++)for(let x=0;x<1024;x++)if(data[(y*1024+x)*4+3]>=40){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}
    return {left:x0-512,right:x1-512,top:y0-580,bottom:y1-580};
  }
  function render(ctx,id,state='idle',frame=0,count=4,empowered=false){
    const airborne=state==='jump'||state==='doublejump',key=[id,state,frame,count,empowered].join(':');
    if(!airborne&&!groundOffsets.has(key))groundOffsets.set(key,bounds(id,state,frame,count,empowered,true).bottom);
    ctx.save();if(!airborne)ctx.translate(0,-groundOffsets.get(key));rawRender(ctx,id,state,frame,count,empowered);ctx.restore();
  }
  function socket(id,state='skill1',frame=2,count=4,empowered=false){
    const d=designs[id],p=pose(state,frame,count,id),top=p.hip-43,arm=chain([19,top+10],p.hands[1],31,34,1,state.startsWith('attack')&&frame===2?1.06:1);
    const [x,y]=arm.end,c=Math.cos(p.lean),s=Math.sin(p.lean),sx=(x*c-y*s+p.lean*30)*d.bodyScale,sy=(x*s+y*c+p.bob)*d.bodyScale;
    const key=[id,state,frame,count,empowered].join(':');if(!groundOffsets.has(key))groundOffsets.set(key,bounds(id,state,frame,count,empowered,true).bottom);
    return {x:p.dx+sx*Math.cos(p.turn)-sy*Math.sin(p.turn),y:p.dy+sx*Math.sin(p.turn)+sy*Math.cos(p.turn)-groundOffsets.get(key)};
  }
  async function load() {
    await Promise.all(Object.keys(designs).map(id=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{images[id]=im;resolve();};im.onerror=()=>reject(new Error('Missing Meridian character art '+id));im.src='../assets/meridian/source-art/characters/'+id+'.png';})));
    for(const id of Object.keys(designs)){const d=designs[id];d.eyes=[];const b=bounds(id,'idle',0,4,false,true);d.bodyScale=(d.height/180)*profiles[id].height/(b.bottom-b.top);}
  }
  function canvas(width,height){const c=document.createElement('canvas');c.width=width;c.height=height;return c;}
  function atlas(job){const c=canvas(job.width,job.height),ctx=c.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    for(const [state,frames] of Object.entries(job.rows))frames.forEach((r,i)=>{ctx.save();ctx.translate(r.x+job.anchorX,r.y+job.anchorY);ctx.beginPath();ctx.rect(-job.anchorX,-job.anchorY,r.w,r.h);ctx.clip();render(ctx,job.id,state,i,frames.length,job.empowered);ctx.restore();});
    return c.toDataURL('image/webp',.96);
  }
  function portrait(id,empowered=false){const c=canvas(384,384),ctx=c.getContext('2d'),d=designs[id];
    const gradient=ctx.createLinearGradient(0,0,384,384);gradient.addColorStop(0,d.coat);gradient.addColorStop(1,'#211332');ctx.fillStyle=gradient;ctx.fillRect(0,0,384,384);
    // Portrait framing follows the face crop, independent of body normalization or a mount.
    const im=images[id],ratio=d.head[3]*im.height/(d.head[2]*im.width),width=Math.min(342,342/ratio),height=width*ratio;
    ctx.save();ctx.translate(192,0);head(ctx,id,{...d,headWidth:width},192+height/2,0,0,empowered);ctx.restore();return c.toDataURL('image/webp',.94);
  }
  function selection(id){const c=canvas(550,900),ctx=c.getContext('2d');const im=images[id],scale=Math.min(510/im.width,840/im.height);ctx.drawImage(im,(550-im.width*scale)/2,900-im.height*scale,im.width*scale,im.height*scale);return c.toDataURL('image/webp',.95);}
  function cutin(id){const c=canvas(1600,680),ctx=c.getContext('2d');const im=images[id],scale=Math.min(950/im.width,650/im.height);ctx.drawImage(im,750-im.width*scale/2,680-im.height*scale,im.width*scale,im.height*scale);return c.toDataURL('image/webp',.95);}
  function icon(id,slot,empowered=false){const c=canvas(192,192),ctx=c.getContext('2d'),d=designs[id];
    const gradient=ctx.createRadialGradient(90,65,8,96,96,135);gradient.addColorStop(0,d.trim);gradient.addColorStop(1,'#27203a');ctx.fillStyle=gradient;ctx.fillRect(0,0,192,192);
    ctx.strokeStyle='#eadacf';ctx.lineWidth=5;ctx.strokeRect(8,8,176,176);
    if(slot==='basic'){ctx.save();ctx.translate(88,225);ctx.scale(1.4,1.4);render(ctx,id,'attack1',2,4,empowered);ctx.restore();}
    if((slot==='skill1'||slot==='skill2')&&window.MeridianEffects?.sets[id]){const keys=Object.keys(MeridianEffects.sets[id]);ctx.drawImage(MeridianEffects.canvas(id,keys[slot==='skill1'?0:1]),18,18,156,156);return c.toDataURL('image/webp',.95);}
    if(slot==='skill1'){star(ctx,100,88,34,'#fff0b7');stroke(ctx,[[31,137],[78,91]],'#d2b7f8',13);star(ctx,139,40,13,'#fef2cf');}
    if(slot==='skill2'){for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(96,146,28+i*24,Math.PI*1.1,Math.PI*1.9);ctx.strokeStyle=i%2?'#e59acb':'#d8b8f3';ctx.lineWidth=10;ctx.stroke();}star(ctx,96,100,27,'#ffdb7b');}
    if(slot==='ultimate'){star(ctx,96,96,61,'#f5cc73',7,.57);ctx.save();ctx.translate(95,159);ctx.scale(.84,.84);head(ctx,id,{...d,headWidth:118},-6,0,0,empowered);ctx.restore();}
    return c.toDataURL('image/webp',.95);
  }
  function spirit(id){const c=canvas(512,512),ctx=c.getContext('2d');ctx.save();ctx.translate(256,495);ctx.scale(2.6,2.6);ctx.shadowColor='#7deed8';ctx.shadowBlur=14;render(ctx,id,'ultimate',2,4);ctx.restore();return c.toDataURL('image/webp',.94);}
  window.MeridianArt={designs,profiles,load,render,bounds,pose,chain,socket,atlas,portrait,selection,cutin,icon,spirit};
})();
