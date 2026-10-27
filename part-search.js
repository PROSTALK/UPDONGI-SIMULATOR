import {TYPES} from './model.js';
export const SEARCH_TERMS={
 mega2560:['아두이노','아두이노 메가','메가','메가2560','arduino','mega','mega 2560','제어보드','마이크로컨트롤러','atmega2560'],
 pca9685:['서보 드라이버','서보드라이버','서보 제어','16채널','pca','pca9685','pwm','i2c','아이투씨','아두이노 모터 제어'],
 droyuke30:['서보','서보모터','모터','드로유케','droyuke','30kg','30kg 서보','270도','로봇 관절'],
 lipo2s:['배터리','리포','리튬폴리머','lipo','2s','7.4v','3300mah','전원','밧데리'],
 becuser:['bec','ubec','비이씨','유벡','전압 강하','강압','컨버터','dc dc','전원장치','서보 전원','6v','레귤레이터']
};
const CHO='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
export function normalizeSearch(value){return String(value||'').normalize('NFC').toLowerCase().replace(/[^a-z0-9가-힣ㄱ-ㅎ]/g,'');}
function initials(value){return [...value].map(c=>{const n=c.charCodeAt(0)-44032;return n>=0&&n<11172?CHO[Math.floor(n/588)]:c;}).join('');}
function fields(part){return [part.name,part.brand,part.id,part.type,TYPES[part.type],...(SEARCH_TERMS[part.id]||[]),...(Array.isArray(part.aliases)?part.aliases.filter(x=>typeof x==='string'):[])].map(normalizeSearch).filter(Boolean);}
export function searchParts(parts,query){
 const q=normalizeSearch(query);if(!q)return parts.slice();
 const tokens=String(query).trim().split(/\s+/).map(normalizeSearch).filter(Boolean);
 return parts.map((part,index)=>{
  const values=fields(part);
  const scoreFor=token=>Math.max(0,...values.map(value=>value===token?100:value.startsWith(token)?75:value.includes(token)?50:/^[ㄱ-ㅎ]+$/.test(token)&&initials(value).includes(token)?40:0));
  let score=scoreFor(q);if(!score&&tokens.length>1&&tokens.every(token=>scoreFor(token)>0))score=30;
  return {part,score,index};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.index-b.index).map(x=>x.part);
}
const RELATED=[
 {keys:['아두이노','arduino','메가','mega','제어보드'],terms:['아두이노 메가','PCA9685','서보 드라이버']},
 {keys:['서보','모터','servo','droyuke','pca','pwm'],terms:['30kg 서보','서보 드라이버','서보 전원','PCA9685']},
 {keys:['전원','배터리','lipo','리포','bec','ubec','강압','컨버터','6v'],terms:['2S LiPo','BEC','서보 전원','전압 강하']}
];
export function relatedSearches(query,parts){
 const q=normalizeSearch(query);const terms=[];
 if(!q)return ['아두이노 메가','서보모터','PCA9685','2S LiPo','BEC'];
 for(const group of RELATED)if(group.keys.some(k=>q.includes(normalizeSearch(k))||normalizeSearch(k).startsWith(q)))terms.push(...group.terms);
 for(const part of searchParts(parts,query).slice(0,3))terms.push(...(SEARCH_TERMS[part.id]||[]).slice(0,3));
 return [...new Set(terms)].filter(term=>normalizeSearch(term)!==q&&searchParts(parts,term).length>0).slice(0,6);
}
