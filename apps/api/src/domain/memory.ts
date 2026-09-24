export interface MemoryEntry{id:string;userId:string;content:string;createdAt:string;updatedAt:string}
export class MemoryService {
 private readonly entries=new Map<string,MemoryEntry>();
 save(entry:MemoryEntry){this.entries.set(entry.id,entry);return entry}
 get(id:string){return this.entries.get(id)}
 search(userId:string,query:string){return[...this.entries.values()].filter(e=>e.userId===userId&&e.content.toLowerCase().includes(query.toLowerCase()))}
}