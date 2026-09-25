import { config } from "../config.js";
import dns from "node:dns/promises";
import net from "node:net";

function blockedHost(host:string):boolean {
  const h=host.toLowerCase();
  if (h==="localhost" || h.endsWith(".localhost") || h==="metadata.google.internal") return true;
  if (net.isIP(h)) {
    const parts=h.split(".").map(Number);
    if (parts.length===4 && (parts[0]===10 || parts[0]===127 || parts[0]===169 && parts[1]===254 || parts[0]===192 && parts[1]===168 || parts[0]===172 && parts[1]>=16 && parts[1]<=31)) return true;
    if (h.includes(":")) return true;
  }
  return false;
}
async function assertSafeUrl(raw:string):Promise<URL>{
  const url=new URL(raw.startsWith("www.")?"https://"+raw:raw);
  if (!["http:","https:"].includes(url.protocol)) throw new Error("unsupported_url_protocol");
  if (blockedHost(url.hostname)) throw new Error("blocked_private_url");
  try { const addresses=await dns.lookup(url.hostname,{all:true}); if(addresses.some(a=>blockedHost(a.address))) throw new Error("blocked_private_url"); } catch(e){ if(e instanceof Error && e.message==="blocked_private_url") throw e; }
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
    const page=await this.open(endpoint);
    const results:Array<{title:string;url:string;snippet:string}>=[]; const re=/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let m:RegExpExecArray|null; while((m=re.exec(page.text)) && results.length<10) results.push({url:m[1],title:stripHtml(m[2]),snippet:stripHtml(m[3])});
    return results;
  }
}
