import { config } from "../config.js";
import dns from "node:dns/promises";
import net from "node:net";

function blockedHost(host:string):boolean {
  const h=host.toLowerCase();
  if (h==="localhost" || h.endsWith(".localhost") || h==="metadata.google.internal") return true;
  if (net.isIP(h)) {
    if (h.includes(":")) return true;
    const parts=h.split(".").map(Number);
    const a=parts[0] ?? -1; const b=parts[1] ?? -1;
    if (parts.length===4 && (a===10 || a===127 || (a===169 && b===254) || (a===192 && b===168) || (a===172 && b>=16 && b<=31))) return true;
  }
  return false;
}
async function assertSafeUrl(raw:string):Promise<URL>{
  const url=new URL(raw.startsWith("www.")?"https://"+raw:raw);
  if(!["http:","https:"].includes(url.protocol)) throw new Error("unsupported_url_protocol");
  if(blockedHost(url.hostname)) throw new Error("blocked_private_url");
  try {
    const addresses=await dns.lookup(url.hostname,{all:true});
    if(addresses.some(a=>blockedHost(a.address))) throw new Error("blocked_private_url");
  } catch(e) {
    if(e instanceof Error && e.message==="blocked_private_url") throw e;
  }
  return url;
}
function stripHtml(html:string):string {
  return html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<noscript[\s\S]*?<\/noscript>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&#39;/g,"'").replace(/&quot;/gi,'"').replace(/\s+/g," ").trim();
}
export interface WebResult { url:string; title:string; text:string }
export class WebService {
  async open(rawUrl:string):Promise<WebResult>{
    const url=await assertSafeUrl(rawUrl);
    const response=await fetch(url,{redirect:"follow",signal:AbortSignal.timeout(config.webTimeoutMs),headers:{"user-agent":"Morok/1.0"}});
    if(!response.ok) throw new Error(`web_http_${response.status}`);
    const html=await response.text();
    const title=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g,"").trim() ?? url.hostname;
    return {url:response.url,title,text:stripHtml(html).slice(0,100_000)};
  }
  async search(query:string):Promise<Array<{title:string;url:string;snippet:string}>>{
    const endpoint="https://html.duckduckgo.com/html/?q="+encodeURIComponent(query);
    const safe=await assertSafeUrl(endpoint);
    const response=await fetch(safe,{signal:AbortSignal.timeout(config.webTimeoutMs),headers:{"user-agent":"Morok/1.0"}});
    if(!response.ok) throw new Error(`web_search_http_${response.status}`);
    const html=await response.text();
    const results:Array<{title:string;url:string;snippet:string}>=[]; const re=/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let m:RegExpExecArray|null;
    while((m=re.exec(html)) && results.length<10) {
      const url=m[1] ?? ""; const title=m[2] ?? ""; const snippet=m[3] ?? "";
      results.push({url,title:stripHtml(title),snippet:stripHtml(snippet)});
    }
    return results;
  }
}
