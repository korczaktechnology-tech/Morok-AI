export interface ModelRequest{message:string;context?:Record<string,unknown>}
export interface ModelResponse{content:string;model:string;finished:boolean}
export interface ModelGateway{complete(request:ModelRequest):Promise<ModelResponse>}
export class StubModelGateway implements ModelGateway{async complete(request:ModelRequest):Promise<ModelResponse>{return{content:`Morok recebeu: ${request.message}`,model:"stub",finished:true}}}