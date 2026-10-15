import {isIP} from 'node:net';

// Only opt into X-Real-IP behind Railway's HTTP edge, which overwrites it.
// Direct/local hosts use the socket; arbitrary Authorization/X-Forwarded-* never identify a bucket.
export function clientAddress(req,trustRailway=false){
 const edge=req.headers['x-real-ip'];
 return trustRailway&&typeof edge==='string'&&isIP(edge)?edge:req.socket.remoteAddress||'unknown';
}
export class ApiRateLimit {
 constructor({ip=600,session=300,write=60,windowMs=60000,maxBuckets=50000}={}){Object.assign(this,{limits:{ip,session,write},windowMs,maxBuckets,buckets:new Map()});}
 take(key,limit,now){
  let b=this.buckets.get(key);if(!b||now-b.at>=this.windowMs){if(!b&&this.buckets.size>=this.maxBuckets)return false;b={at:now,n:0};this.buckets.set(key,b);}return ++b.n<=limit;
 }
 allow(req,session,trustRailway=false){
  const now=Date.now(),ip=clientAddress(req,trustRailway),group=req.path.split('/')[2]||'api';
  if(!this.take('ip:'+ip,this.limits.ip,now))return false;
  if(req.method!=='GET'&&!this.take('write:'+ip+':'+group,this.limits.write,now))return false;
  return !session||this.take('session:'+session.id+':'+group,this.limits.session,now);
 }
 prune(){const now=Date.now();for(const [k,b] of this.buckets)if(now-b.at>=this.windowMs)this.buckets.delete(k);}
}
