import { MAX_INPUT, normalizeAnalysis, SYSTEM_PROMPT, validDate } from "../../../lib/clarify";
export const dynamic = "force-dynamic";
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
export async function POST(request: Request) {
  const origin=request.headers.get("origin");
  if(origin && origin!==new URL(request.url).origin)return json({error:"请求来源不匹配，请从本站页面操作。"},403);
  if(!request.headers.get("content-type")?.includes("application/json"))return json({error:"请使用 JSON 请求。"},415);
  let data:any;
  try{
    const reader=request.body?.getReader();if(!reader)return json({error:"没有消息内容。"},400);
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>90000){await reader.cancel();return json({error:"消息过长，请分批输入。"},413);}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
    data=JSON.parse(new TextDecoder().decode(bytes));
  }catch{return json({error:"请求格式不正确。"},400);}
  if(!data||typeof data!=="object")return json({error:"请求格式不正确。"},400);
  if(typeof data.source!=="string" || !data.source.trim() || data.source.length>MAX_INPUT)return json({error:"请输入 1–16000 字的消息。"},400);
  if(typeof data.apiKey!=="string"||data.apiKey.length<10||data.apiKey.length>256||/[\s\r\n]/.test(data.apiKey))return json({error:"请在设置中填写有效的 DeepSeek API Key。"},400);
  if(data.consent!==true)return json({error:"请先同意将这次消息发送给 DeepSeek 进行分析。"},400);
  if(typeof data.reference!=="string"||!validDate(data.reference+"T00:00:00Z"))return json({error:"请选择参考日期。"},400);
  if(typeof data.timeZone!=="string")return json({error:"时区无效。"},400);
  try{new Intl.DateTimeFormat("zh-CN",{timeZone:data.timeZone}).format();}catch{return json({error:"时区无效。"},400);}
  try{
    const upstream=await fetch("https://api.deepseek.com/chat/completions",{method:"POST",
      headers:{"Authorization":"Bearer "+data.apiKey,"Content-Type":"application/json"},
      body:JSON.stringify({model:"deepseek-flash",thinking:{type:"disabled"},response_format:{type:"json_object"},max_tokens:6000,
      messages:[{role:"system",content:SYSTEM_PROMPT},{role:"user",content:JSON.stringify({referenceDate:data.reference,timeZone:data.timeZone,messages:data.source})}]}),
      signal:AbortSignal.timeout(65000)});
    if(!upstream.ok) {
      const status=upstream.status;
      return json({error:status===401?"API Key 无效，请检查设置。":status===402?"DeepSeek 账户余额不足，请检查账户。":status===429?"请求过于频繁，请稍后再试。":"AI 服务暂时不可用，请重试或使用本地初筛。"},status===401?401:502);
    }
    const result:any=await upstream.json();
    if(result.choices?.[0]?.finish_reason==="length")return json({error:"消息较多，分析被截断，请减少消息后重试。"},502);
    const content=result.choices?.[0]?.message?.content;
    if(typeof content!=="string")return json({error:"AI 没有返回有效内容，请重试。"},502);
    let parsed;try{parsed=JSON.parse(content);}catch{return json({error:"AI 返回的格式无法解析，请重试。"},502);}
    return json(normalizeAnalysis(parsed,data.source));
  }catch(error){
    return json({error:error instanceof Error && (error.name==="TimeoutError"||error.name==="AbortError")?"分析超时，请减少消息后重试。":"分析未完成，请检查网络后重试。"},502);
  }
}
