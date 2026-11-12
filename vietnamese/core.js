export const STORAGE_KEY = 'noi-moi-ngay.progress.v1';
export function freshProgress() { return {version:1,items:{},activity:[],settings:{rate:0.85,voiceURI:'',recognitionConsent:false}}; }
export function readProgress(storage) {
  try {
    const p=JSON.parse(storage.getItem(STORAGE_KEY));
    if(!p || p.version!==1 || !p.items || typeof p.items!=='object' || Array.isArray(p.items)) return freshProgress();
    const clean=freshProgress();
    for(const [id,x] of Object.entries(p.items)) if(x && typeof x==='object' && !Array.isArray(x) && /^[a-z]+:[\w-]+$/.test(id)) clean.items[id]={done:x.done===true,needsReview:x.needsReview===true,attempts:Number.isFinite(Number(x.attempts))?Math.max(0,Math.floor(Number(x.attempts))):0,lastAt:typeof x.lastAt==='string'?x.lastAt:''};
    clean.activity=Array.isArray(p.activity)?p.activity.filter(x=>x && typeof x.date==='string' && typeof x.key==='string').slice(-1000):[];
    if(p.settings && typeof p.settings==='object')clean.settings={rate:Math.min(1.1,Math.max(.6,Number(p.settings.rate)||.85)),voiceURI:typeof p.settings.voiceURI==='string'?p.settings.voiceURI:'',recognitionConsent:p.settings.recognitionConsent===true};
    return clean;
  } catch { return freshProgress(); }
}
export function localDate(date=new Date()) {return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function recordAttempt(progress,key,success,date=new Date()) {
  const previous=progress.items[key]||{};
  progress.items[key]={done:success,needsReview:!success,attempts:(previous.attempts||0)+1,lastAt:date.toISOString()};
  progress.activity.push({date:localDate(date),key,success});progress.activity=progress.activity.slice(-1000);
}
export function shuffledTokens(tokens,random=Math.random) {
  const result=tokens.map((text,id)=>({text,id}));
  for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
  if(result.length>1 && result.every((t,i)=>t.id===i))[result[0],result[1]]=[result[1],result[0]];
  return result;
}
export function escapeHTML(value){return String(value).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));}
